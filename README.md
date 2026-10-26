# Catalogue Backend

A backend application for managing a product catalogue using Node.js, Express.js, and PostgreSQL. The project maintains separate databases for development and automated testing to ensure test operations do not affect real application data.

## 🚀 Features

- REST API development using Node.js and Express.js
- PostgreSQL database integration
- Separate development and testing databases
- Environment-based configuration
- Automated testing using a dedicated test database
- Database isolation to protect development data during tests

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Testing:** Add your configured testing framework (e.g., Jest or Vitest)
- **Configuration:** dotenv

## 📁 Project Structure

```text
catalogue-backend/
├── src/
│   ├── controllers/
│   ├── routes/
│   ├── services/
│   ├── models/
│   └── config/
├── tests/
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

*The folder structure above is a suggested structure; adjust it to match your actual project.*

## ⚙️ Prerequisites

Make sure you have installed:

- Node.js
- npm
- PostgreSQL

## 🔧 Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/ponnanapavan/ponnanapavan-getto_india_ecommerce_backend.git
   ```

2. Navigate to the project directory:

   ```bash
   cd catalogue-backend
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a `.env` file in the project root and configure your database connections.

## 🔐 Environment Variables

Configure the following variables in your local `.env` file:

```env
PORT=5000

# Development database
DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/catalogue

# Test database
TEST_DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/catalogue_test
```

Replace `<YOUR_PASSWORD>` with your PostgreSQL password.

**Database usage:**

| Database | Purpose |
|---|---|
| `catalogue` | Development and application data |
| `catalogue_test` | Automated tests and test data |

Keep your `.env` file private and do not commit it to Git.

## 🗄️ Database Setup

Create both databases in PostgreSQL:

```sql
CREATE DATABASE catalogue;
CREATE DATABASE catalogue_test;
```

You can run these commands using `psql` or a PostgreSQL administration tool.

Ensure that your application runs the required schema migrations or setup scripts against each database.

## ▶️ Running the Application

Start the application using the scripts configured in your `package.json`.

For example:

```bash
npm start
```

For development mode, if your project supports it:

```bash
npm run dev
```

The application runs on port `5000` unless configured otherwise.

## 🧪 Running Tests

Run your test suite using the test script configured in `package.json`:

```bash
npm test
```

Before running tests, ensure that the test configuration connects to `TEST_DATABASE_URL`, not `DATABASE_URL`.

**Important:** Test setup, database cleanup, and test migrations should target only `catalogue_test`. Avoid running destructive test operations against the development database.

## 🔒 Security Best Practices

- Never commit `.env` files or database credentials.
- Add `.env` to `.gitignore`.
- Use `.env.example` to document required environment variables without real passwords.
- Use a dedicated PostgreSQL user with limited permissions when appropriate.
- Keep development and test database connections separate.


## 📌 Future Improvements

- Add product CRUD APIs.
- Implement request validation and centralized error handling.
- Add database migrations.
- Expand automated API and integration tests.
- Configure CI/CD to run tests against the test database.

## 👨‍💻 Author

Ponnana Pavan

