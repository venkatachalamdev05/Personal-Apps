require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const {
    pool,
    initDatabase
} = require("./database");


const app = express();


// =====================================================
// CONFIG
// =====================================================

const PORT =
    process.env.PORT || 3000;

const JWT_SECRET =
    process.env.JWT_SECRET;


if (!JWT_SECRET) {

    console.error(
        "ERROR: JWT_SECRET is missing."
    );

    process.exit(1);
}


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    cors({
        origin: true,
        credentials: true
    })
);


app.use(
    express.json({
        limit: "2mb"
    })
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.json({
            message: "Daily Tracker API is running",
            status: "ok"
        });

    }
);


app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query("SELECT 1");

            res.json({
                status: "ok",
                database: "connected"
            });

        }
        catch (error) {

            console.error(error);

            res.status(500).json({
                status: "error",
                database: "disconnected"
            });

        }

    }
);


// =====================================================
// JWT HELPERS
// =====================================================

function createToken(user) {

    return jwt.sign(
        {
            userId: user.id,
            email: user.email
        },

        JWT_SECRET,

        {
            expiresIn: "30d"
        }
    );

}


function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    if (!authHeader) {

        return res.status(401).json({
            message: "Authentication required"
        });

    }


    const parts =
        authHeader.split(" ");


    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {

        return res.status(401).json({
            message: "Invalid authorization format"
        });

    }


    const token =
        parts[1];


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.userId =
            decoded.userId;

        req.userEmail =
            decoded.email;


        next();

    }
    catch (error) {

        return res.status(401).json({
            message: "Invalid or expired token"
        });

    }

}


// =====================================================
// AUTH - REGISTER
// =====================================================

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;


            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    message:
                        "Name, email and password are required"
                });

            }


            if (password.length < 6) {

                return res.status(400).json({
                    message:
                        "Password must be at least 6 characters"
                });

            }


            const normalizedEmail =
                email
                    .trim()
                    .toLowerCase();


            const existingUser =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE email = $1
                    `,
                    [normalizedEmail]
                );


            if (
                existingUser.rows.length > 0
            ) {

                return res.status(409).json({
                    message:
                        "Email already registered"
                });

            }


            const passwordHash =
                await bcrypt.hash(
                    password,
                    12
                );


            const userId =
                crypto.randomUUID();


            const result =
                await pool.query(
                    `
                    INSERT INTO users
                    (
                        id,
                        name,
                        email,
                        password_hash
                    )
                    VALUES
                    ($1, $2, $3, $4)
                    RETURNING
                        id,
                        name,
                        email
                    `,
                    [
                        userId,
                        name.trim(),
                        normalizedEmail,
                        passwordHash
                    ]
                );


            const user =
                result.rows[0];


            const token =
                createToken(user);


            res.status(201).json({

                message:
                    "Account created successfully",

                token,

                user

            });

        }
        catch (error) {

            console.error(
                "REGISTER ERROR:",
                error
            );


            res.status(500).json({
                message:
                    "Registration failed"
            });

        }

    }
);


// =====================================================
// AUTH - LOGIN
// =====================================================

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const {
                email,
                password
            } = req.body;


            if (
                !email ||
                !password
            ) {

                return res.status(400).json({
                    message:
                        "Email and password are required"
                });

            }


            const normalizedEmail =
                email
                    .trim()
                    .toLowerCase();


            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        email,
                        password_hash
                    FROM users
                    WHERE email = $1
                    `,
                    [normalizedEmail]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }


            const user =
                result.rows[0];


            const passwordValid =
                await bcrypt.compare(
                    password,
                    user.password_hash
                );


            if (!passwordValid) {

                return res.status(401).json({
                    message:
                        "Invalid email or password"
                });

            }


            const safeUser = {

                id: user.id,

                name: user.name,

                email: user.email

            };


            const token =
                createToken(
                    safeUser
                );


            res.json({

                message:
                    "Login successful",

                token,

                user:
                    safeUser

            });

        }
        catch (error) {

            console.error(
                "LOGIN ERROR:",
                error
            );


            res.status(500).json({
                message:
                    "Login failed"
            });

        }

    }
);


// =====================================================
// AUTH - CURRENT USER
// =====================================================

app.get(
    "/api/auth/me",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        name,
                        email
                    FROM users
                    WHERE id = $1
                    `,
                    [req.userId]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(401).json({
                    message:
                        "User no longer exists"
                });

            }


            res.json({
                user:
                    result.rows[0]
            });

        }
        catch (error) {

            console.error(error);

            res.status(500).json({
                message:
                    "Could not retrieve user"
            });

        }

    }
);


// =====================================================
// GET USER DATA
// =====================================================

app.get(
    "/api/data",
    authenticateToken,
    async (req, res) => {

        try {

            const categoriesResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        name,
                        created_at,
                        updated_at
                    FROM categories
                    WHERE user_id = $1
                    ORDER BY created_at ASC
                    `,
                    [req.userId]
                );


            const trackingResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        category_id,
                        TO_CHAR(date, 'YYYY-MM-DD')
                            AS date,
                        status,
                        updated_at
                    FROM tracking
                    WHERE user_id = $1
                    ORDER BY date ASC
                    `,
                    [req.userId]
                );


            res.json({

                categories:
                    categoriesResult.rows,

                tracking:
                    trackingResult.rows

            });

        }
        catch (error) {

            console.error(
                "GET DATA ERROR:",
                error
            );


            res.status(500).json({
                message:
                    "Could not load data"
            });

        }

    }
);


// =====================================================
// SYNC
// =====================================================

app.post(
    "/api/sync",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();


        try {

            const {
                categories = [],
                tracking = []
            } = req.body;


            await client.query(
                "BEGIN"
            );


            // Clear stale tracking data for this user so
            // unchecked days are truly removed.
            await client.query(
                `
                DELETE FROM tracking
                WHERE user_id = $1
                `,
                [req.userId]
            );


            // -----------------------------------------
            // CATEGORIES
            // -----------------------------------------

            for (
                const category
                of categories
            ) {

                if (
                    !category.id ||
                    !category.name
                ) {

                    continue;

                }


                /*
                    IMPORTANT:

                    We always use req.userId.

                    Never trust category.user_id
                    coming from the browser.
                */

                const existing =
                    await client.query(
                        `
                        SELECT id
                        FROM categories
                        WHERE id = $1
                        AND user_id = $2
                        `,
                        [
                            category.id,
                            req.userId
                        ]
                    );


                if (
                    existing.rows.length > 0
                ) {

                    await client.query(
                        `
                        UPDATE categories

                        SET
                            name = $1,
                            updated_at =
                                CURRENT_TIMESTAMP

                        WHERE id = $2
                        AND user_id = $3
                        `,
                        [
                            category.name,
                            category.id,
                            req.userId
                        ]
                    );

                }
                else {

                    await client.query(
                        `
                        INSERT INTO categories
                        (
                            id,
                            user_id,
                            name,
                            created_at,
                            updated_at
                        )

                        VALUES
                        (
                            $1,
                            $2,
                            $3,
                            COALESCE(
                                $4,
                                CURRENT_TIMESTAMP
                            ),
                            CURRENT_TIMESTAMP
                        )

                        ON CONFLICT (id)
                        DO NOTHING
                        `,
                        [
                            category.id,
                            req.userId,
                            category.name,
                            category.created_at
                        ]
                    );

                }

            }


            // -----------------------------------------
            // TRACKING
            // -----------------------------------------

            for (
                const item
                of tracking
            ) {

                if (
                    !item.id ||
                    !item.category_id ||
                    !item.date ||
                    !item.status
                ) {

                    continue;

                }


                /*
                    Make sure the category actually
                    belongs to this user.
                */

                const categoryCheck =
                    await client.query(
                        `
                        SELECT id
                        FROM categories
                        WHERE id = $1
                        AND user_id = $2
                        `,
                        [
                            item.category_id,
                            req.userId
                        ]
                    );


                if (
                    categoryCheck.rows.length === 0
                ) {

                    continue;

                }


                await client.query(
                    `
                    INSERT INTO tracking
                    (
                        id,
                        user_id,
                        category_id,
                        date,
                        status,
                        updated_at
                    )

                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        CURRENT_TIMESTAMP
                    )

                    ON CONFLICT
                    (
                        user_id,
                        category_id,
                        date
                    )

                    DO UPDATE SET

                        status =
                            EXCLUDED.status,

                        updated_at =
                            CURRENT_TIMESTAMP
                    `,
                    [
                        item.id,
                        req.userId,
                        item.category_id,
                        item.date,
                        item.status
                    ]
                );

            }


            await client.query(
                "COMMIT"
            );


            // Return fresh server data

            const categoriesResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        name,
                        created_at,
                        updated_at
                    FROM categories
                    WHERE user_id = $1
                    ORDER BY created_at ASC
                    `,
                    [req.userId]
                );


            const trackingResult =
                await pool.query(
                    `
                    SELECT
                        id,
                        user_id,
                        category_id,
                        TO_CHAR(date, 'YYYY-MM-DD')
                            AS date,
                        status,
                        updated_at
                    FROM tracking
                    WHERE user_id = $1
                    ORDER BY date ASC
                    `,
                    [req.userId]
                );


            res.json({

                message:
                    "Sync successful",

                categories:
                    categoriesResult.rows,

                tracking:
                    trackingResult.rows

            });

        }
        catch (error) {

            await client.query(
                "ROLLBACK"
            );


            console.error(
                "SYNC ERROR:",
                error
            );


            res.status(500).json({
                message:
                    "Sync failed"
            });

        }
        finally {

            client.release();

        }

    }
);


// =====================================================
// START SERVER
// =====================================================

async function startServer() {

    try {

        await initDatabase();


        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Daily Tracker API running on port ${PORT}`
                );

            }
        );

    }
    catch (error) {

        console.error(
            "SERVER START ERROR:",
            error
        );

        process.exit(1);

    }

}


startServer();