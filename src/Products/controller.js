import { Op, fn, col, where as sqlWhere } from 'sequelize';
import Product from '../models/Product.js';

const SORTS = {
  price_asc:  [['price', 'ASC']],
  price_desc: [['price', 'DESC']],
  rating:     [['rating', 'DESC']],
  newest:     [['createdAt', 'DESC']],
  name_asc:   [['name', 'ASC']],
  name:       [['name', 'ASC']],
};

const CURSOR_SORTS = new Set(['price_asc', 'price_desc', 'rating', 'newest', 'name', 'name_asc']);

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
const asList = (v) => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const asText = (v) => (typeof v === 'string' ? v.trim() : '');

/* ================================================================
 *  Cursor helpers
 * ================================================================ */

function encodeCursor(sortValue, id) {
  return Buffer.from(JSON.stringify({ v: sortValue, id })).toString('base64');
}

function decodeCursor(cursor) {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    if (typeof parsed?.id !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildCursorWhere(sort, cursor) {
  const [column, direction] = SORTS[sort][0];
  const op = direction === 'ASC' ? Op.gt : Op.lt;
  return {
    [Op.or]: [
      { [column]: { [op]: cursor.v } },
      { [column]: cursor.v, id: { [Op.gt]: cursor.id } },
    ],
  };
}

/* ================================================================
 *  Fuzzy cache (60s TTL)
 * ================================================================ */
const FUZZY_TTL_MS = 60_000;
const FUZZY_MAX = 500;
const fuzzyCache = new Map();

function fuzzyCacheGet(key) {
  const hit = fuzzyCache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) { fuzzyCache.delete(key); return undefined; }
  fuzzyCache.delete(key);
  fuzzyCache.set(key, hit);
  return hit.value;
}

function fuzzyCacheSet(key, value) {
  if (fuzzyCache.size >= FUZZY_MAX) {
    fuzzyCache.delete(fuzzyCache.keys().next().value);
  }
  fuzzyCache.set(key, { value, expires: Date.now() + FUZZY_TTL_MS });
}

/* ================================================================
 *  Filter + text-search clause builders
 * ================================================================ */

function buildBaseFilters(q) {
  const categories = asList(q.category);
  const brands = asList(q.brand);
  const clauses = [];

  if (categories.length) clauses.push({ category: { [Op.in]: categories } });
  if (brands.length) clauses.push({ brand: { [Op.in]: brands } });
  if (q.minPrice) clauses.push({ price: { [Op.gte]: Number(q.minPrice) } });
  if (q.maxPrice) clauses.push({ price: { [Op.lte]: Number(q.maxPrice) } });
  if (q.minRating) clauses.push({ rating: { [Op.gte]: Number(q.minRating) } });
  if (q.inStock === 'true') clauses.push({ inStock: true });

  return clauses;
}

function buildFtsClause(q) {
  return sqlWhere(col('search_vector'),
    { [Op.match]: fn('websearch_to_tsquery', 'english', q) });
}

function buildLikeClause(q) {
  const like = { [Op.iLike]: `%${escapeLike(q)}%` };
  return {
    [Op.or]: [
      { name: like }, { description: like }, { brand: like },
      { category: like }, { sku: like },
    ],
  };
}

/* ================================================================
 *  Validation
 * ================================================================ */

function validateQuery(q) {
  const errors = [];
  const { minPrice, maxPrice, minRating, inStock, sort, page, limit } = q;

  if (q.q.length > 100) errors.push('search text is too long (max 100 characters)');
  if (minPrice && (isNaN(minPrice) || Number(minPrice) < 0)) errors.push('minPrice must be 0 or more');
  if (maxPrice && (isNaN(maxPrice) || Number(maxPrice) < 0)) errors.push('maxPrice must be 0 or more');
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    errors.push('minPrice cannot be higher than maxPrice');
  }
  if (minRating && (isNaN(minRating) || minRating < 0 || minRating > 5)) errors.push('minRating must be between 0 and 5');
  if (inStock !== undefined && inStock !== 'true' && inStock !== 'false') errors.push("inStock must be 'true' or 'false'");
  if (!SORTS[sort]) errors.push('invalid sort value');
  if (!Number.isInteger(page) || page < 1) errors.push('page must be 1 or more');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.push('limit must be between 1 and 100');

  return errors;
}

/* ================================================================
 *  Text-search resolver: fts → like → fuzzy → none
 * ================================================================ */

async function resolveTextClause(qText, baseClauses) {
  if (!qText) return { textClause: null, usedSearch: null, fuzzy: false };

  const probe = (clause) =>
    Product.count({ where: { [Op.and]: [...baseClauses, clause] } });

  // 1) full-text
  try {
    const fts = buildFtsClause(qText);
    if ((await probe(fts)) > 0) return { textClause: fts, usedSearch: 'fts', fuzzy: false };
  } catch { /* ignore */ }

  // 2) substring (only if length >= 3)
  if (qText.length >= 3) {
    const like = buildLikeClause(qText);
    if ((await probe(like)) > 0) return { textClause: like, usedSearch: 'like', fuzzy: false };
  }

  // 3) fuzzy (cached)
  const cacheKey = `fz:${qText}`;
  const cached = fuzzyCacheGet(cacheKey);
  if (cached) return { textClause: cached, usedSearch: 'fuzzy', fuzzy: true };

  try {
    const fuzzyClause = {
      [Op.or]: [
        sqlWhere(fn('word_similarity', qText, col('name')), { [Op.gt]: 0.5 }),
        sqlWhere(fn('word_similarity', qText, col('brand')), { [Op.gt]: 0.5 }),
      ],
    };
    if ((await probe(fuzzyClause)) > 0) {
      fuzzyCacheSet(cacheKey, fuzzyClause);
      return { textClause: fuzzyClause, usedSearch: 'fuzzy', fuzzy: true };
    }
  } catch (e) {
    console.error('Fuzzy search skipped:', e.message);
  }

  return { textClause: null, usedSearch: 'none', fuzzy: false };
}

/* ================================================================
 *  Main handler
 * ================================================================ */

export const searchProducts = async (req, res, next) => {
  try {
    const qText = asText(req.query.q);
    const sort = req.query.sort || 'newest';
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const cursorRaw = req.query.cursor;
    const modeParam = req.query.mode;

    // Cursor mode is used when:
    //   - the caller passes ?cursor=... (paging through pages 2..N), OR
    //   - the caller explicitly asks for it with ?mode=cursor (page 1)
    // Otherwise offset mode is used (default, keeps the UI pagination working).
    const useCursorMode = !!cursorRaw || modeParam === 'cursor';

    const errors = validateQuery({ ...req.query, q: qText, sort, page, limit });
    if (cursorRaw && !CURSOR_SORTS.has(sort)) {
      errors.push('cursor pagination is not supported for this sort');
    }
    if (modeParam === 'cursor' && !CURSOR_SORTS.has(sort)) {
      errors.push('cursor pagination is not supported for this sort');
    }
    if (errors.length) {
      return res.status(400).json({ error: 'Invalid query', details: errors });
    }

    const baseClauses = buildBaseFilters(req.query);
    const { textClause, usedSearch, fuzzy } =
      await resolveTextClause(qText, baseClauses);

    /* ---------- CURSOR MODE ---------- */
    if (useCursorMode) {
      // No cursor = first page (valid for ?mode=cursor); cursor required for later pages.
      let cursor = null;
      if (cursorRaw) {
        cursor = decodeCursor(cursorRaw);
        if (!cursor) {
          return res.status(400).json({ error: 'Invalid query', details: ['malformed cursor'] });
        }
      }

      // If a text search was requested but nothing matched → empty
      if (qText && !textClause) {
        return res.json({
          data: [],
          pagination: { mode: 'cursor', limit, hasMore: false, nextCursor: null },
          fuzzy: false,
          usedSearch: 'none',
        });
      }

      const where = {
        [Op.and]: [
          ...baseClauses,
          ...(textClause ? [textClause] : []),
          ...(cursor ? [buildCursorWhere(sort, cursor)] : []),
        ],
      };

      const rows = await Product.findAll({
        where,
        order: [...SORTS[sort], ['id', 'ASC']],
        limit: limit + 1,
      });

      const hasMore = rows.length > limit;
      const pageRows = hasMore ? rows.slice(0, limit) : rows;
      const last = pageRows[pageRows.length - 1];
      const [sortColumn] = SORTS[sort][0];
      const nextCursor = hasMore && last
        ? encodeCursor(last[sortColumn], last.id)
        : null;

      return res.json({
        data: pageRows,
        pagination: { mode: 'cursor', limit, hasMore, nextCursor },
        fuzzy,
        usedSearch,
      });
    }

    /* ---------- OFFSET MODE ---------- */
    // If a text search was requested but nothing matched → empty
    if (qText && !textClause) {
      return res.json({
        data: [],
        pagination: { mode: 'offset', page, limit, total: 0, totalPages: 0 },
        fuzzy: false,
        usedSearch: 'none',
      });
    }

    const where = textClause
      ? { [Op.and]: [...baseClauses, textClause] }
      : { [Op.and]: baseClauses };

    const { rows, count } = await Product.findAndCountAll({
      where,
      order: [...SORTS[sort], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      data: rows,
      pagination: {
        mode: 'offset',
        page,
        limit,
        total: count,
        totalPages: limit ? Math.ceil(count / limit) : 0,
      },
      fuzzy,
      usedSearch,
    });
  } catch (err) {
    next(err);
  }
};

/* ================================================================
 *  Filters handler (unchanged)
 * ================================================================ */

export const getFilters = async (req, res, next) => {
  try {
    const count = (column) =>
      Product.findAll({
        attributes: [column, [fn('COUNT', col('id')), 'count']],
        group: [column],
        order: [[column, 'ASC']],
        raw: true,
      }).then((rows) => rows.map((r) => ({ name: r[column], count: Number(r.count) })));

    const [categories, brands] = await Promise.all([count('category'), count('brand')]);
    res.json({ categories, brands });
  } catch (err) {
    next(err);
  }
};

/* ================================================================
 *  Suggest handler (unchanged)
 * ================================================================ */

export const suggest = async (req, res, next) => {
  try {
    const qText = asText(req.query.q);
    if (qText.length < 2 || qText.length > 100) return res.json({ suggestions: [] });

    const rows = await Product.findAll({
      attributes: ['name'],
      where: { name: { [Op.iLike]: `%${escapeLike(qText)}%` } },
      group: ['name'],
      order: [['name', 'ASC']],
      limit: 8,
      raw: true,
    });
    res.json({ suggestions: rows.map((r) => r.name) });
  } catch (err) {
    next(err);
  }
};