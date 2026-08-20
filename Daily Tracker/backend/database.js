const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});


async function initDatabase() {

    console.log("Connecting to PostgreSQL...");

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);


    await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);


    await pool.query(`
        CREATE TABLE IF NOT EXISTS tracking (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            status VARCHAR(20) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            UNIQUE(user_id, category_id, date)
        );
    `);


    // Helpful indexes for multi-user queries

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_categories_user
        ON categories(user_id);
    `);


    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_tracking_user
        ON tracking(user_id);
    `);


    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        idx_tracking_category
        ON tracking(category_id);
    `);


    console.log(
        "PostgreSQL database initialized successfully."
    );
}


module.exports = {
    pool,
    initDatabase
};