const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const pool = require("./db");

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// =====================================================
// TEST ROUTE
// =====================================================

app.get("/", (req, res) => {
    res.send("DevSecure backend is running!");
});

const PORT = process.env.PORT || 5000;

// =====================================================
// DATABASE CONNECTION TEST
// =====================================================

pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("Database connection error:", err);
    } else {
        console.log("PostgreSQL connected:", result.rows[0]);
    }
});

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            error: "Access denied. No token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            error: "Access denied. Invalid token format."
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Store logged-in user's information
        req.user = decoded;

        next();
    } catch (error) {
        return res.status(403).json({
            error: "Invalid or expired token."
        });
    }
}

// =====================================================
// SIGNUP API
// =====================================================

app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password, publicKey } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: "Name, email and password are required"
            });
        }

        // Check if user already exists
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({
                error: "User already exists"
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Save user and PUBLIC key
        const newUser = await pool.query(
            `INSERT INTO users (name, email, password_hash, public_key)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, created_at`,
            [
                name,
                email,
                passwordHash,
                publicKey ? JSON.stringify(publicKey) : null
            ]
        );

        // Create JWT
        const token = jwt.sign(
            {
                id: newUser.rows[0].id,
                email: newUser.rows[0].email
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            message: "User created successfully",
            token,
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error("Signup error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// LOGIN API
// =====================================================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password, publicKey } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: "Email and password are required"
            });
        }

        // Find user
        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        const user = userResult.rows[0];

        // Check password
        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                error: "Invalid email or password"
            });
        }

        // Keep the user's original public key.
        // It must continue matching the private key stored in the browser.
        if (!user.public_key && publicKey) {
            await pool.query(
                "UPDATE users SET public_key = $1 WHERE id = $2",
                [JSON.stringify(publicKey), user.id]
            );
        }

        // Create JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// FIND USER BY EMAIL
// Used when sharing a file
// =====================================================

app.get("/api/users/search", authenticateToken, async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                error: "Email is required"
            });
        }

        const result = await pool.query(
            `SELECT id, email, public_key
             FROM users
             WHERE LOWER(email) = LOWER($1)`,
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "User not found"
            });
        }

        const foundUser = result.rows[0];

        res.json({
            id: foundUser.id,
            email: foundUser.email,
            publicKey: foundUser.public_key
                ? JSON.parse(foundUser.public_key)
                : null
        });

    } catch (error) {
        console.error("User search error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// UPLOAD ENCRYPTED FILE
// =====================================================

app.post("/api/files", authenticateToken, async (req, res) => {
    try {
        const {
            filename,
            mimeType,
            size,
            ciphertext,
            iv,
            wrappedKey
        } = req.body;

        if (!filename || !ciphertext || !iv || !wrappedKey) {
            return res.status(400).json({
                error: "Missing required file data"
            });
        }

        const ownerId = req.user.id;

        const newFile = await pool.query(
            `INSERT INTO files
            (
                owner_id,
                filename,
                mime_type,
                file_size,
                ciphertext,
                iv,
                wrapped_key
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, filename, created_at`,
            [
                ownerId,
                filename,
                mimeType,
                size,
                ciphertext,
                iv,
                wrappedKey
            ]
        );

        res.status(201).json({
            message: "File uploaded successfully",
            file: newFile.rows[0]
        });

    } catch (error) {
        console.error("File upload error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// GET ALL FILES
// Own files + files shared with logged-in user
// =====================================================

app.get("/api/files", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // Files owned by the logged-in user
        const ownedResult = await pool.query(
            `SELECT id, filename, mime_type, file_size, created_at
             FROM files
             WHERE owner_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        // Files shared with the logged-in user
        const sharedResult = await pool.query(
            `SELECT
                f.id,
                f.filename,
                f.mime_type,
                f.file_size,
                f.created_at,
                u.email AS owner_email
             FROM file_shares fs
             JOIN files f ON fs.file_id = f.id
             JOIN users u ON f.owner_id = u.id
             WHERE fs.recipient_id = $1
             ORDER BY fs.created_at DESC`,
            [userId]
        );

        // Use the names expected by Dashboard.jsx
        res.json({
            owned: ownedResult.rows.map((file) => ({
                id: file.id,
                filename: file.filename,
                mimeType: file.mime_type,
                size: file.file_size,
                createdAt: file.created_at
            })),

            shared: sharedResult.rows.map((file) => ({
                id: file.id,
                filename: file.filename,
                mimeType: file.mime_type,
                size: file.file_size,
                createdAt: file.created_at,
                ownerEmail: file.owner_email
            }))
        });

    } catch (error) {
        console.error("Get files error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// GET A SINGLE FILE
// Owner can access their own file.
// Recipient can access a file shared with them.
// =====================================================

app.get("/api/files/:id", authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.id;

        // Check if the logged-in user owns the file
        const ownerResult = await pool.query(
            `SELECT id, owner_id, filename, mime_type,
                    file_size, ciphertext, iv, wrapped_key
             FROM files
             WHERE id = $1 AND owner_id = $2`,
            [fileId, userId]
        );

        // Owner gets their encrypted file
        if (ownerResult.rows.length > 0) {
            const file = ownerResult.rows[0];

            return res.json({
                id: file.id,
                ownerId: file.owner_id,
                filename: file.filename,
                mimeType: file.mime_type,
                size: file.file_size,
                ciphertext: file.ciphertext,
                iv: file.iv,
                wrappedKey: file.wrapped_key
            });
        }

        // Otherwise check if the file was shared with this user
        const sharedResult = await pool.query(
            `SELECT
                f.id,
                f.owner_id,
                f.filename,
                f.mime_type,
                f.file_size,
                f.ciphertext,
                f.iv,
                fs.wrapped_key
             FROM files f
             JOIN file_shares fs ON fs.file_id = f.id
             WHERE f.id = $1
             AND fs.recipient_id = $2`,
            [fileId, userId]
        );

        if (sharedResult.rows.length === 0) {
            return res.status(404).json({
                error: "File not found or access denied"
            });
        }

        const file = sharedResult.rows[0];

        res.json({
            id: file.id,
            ownerId: file.owner_id,
            filename: file.filename,
            mimeType: file.mime_type,
            size: file.file_size,
            ciphertext: file.ciphertext,
            iv: file.iv,
            wrappedKey: file.wrapped_key
        });

    } catch (error) {
        console.error("Get file error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// DELETE A FILE
// Only the owner can delete their own file.
// =====================================================

app.delete("/api/files/:id", authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `DELETE FROM files
             WHERE id = $1 AND owner_id = $2
             RETURNING id`,
            [fileId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: "File not found or access denied"
            });
        }

        res.json({
            message: "File deleted successfully"
        });

    } catch (error) {
        console.error("Delete file error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// =====================================================
// FILE SHARING ROUTES
// =====================================================

// Get everyone a file is shared with
app.get("/api/files/:id/shares", authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;
        const ownerId = req.user.id;

        // Check ownership
        const fileCheck = await pool.query(
            "SELECT id FROM files WHERE id = $1 AND owner_id = $2",
            [fileId, ownerId]
        );

        if (fileCheck.rows.length === 0) {
            return res.status(404).json({
                error: "File not found or access denied"
            });
        }

        const result = await pool.query(
            `SELECT users.id, users.email
             FROM file_shares
             JOIN users
             ON file_shares.recipient_id = users.id
             WHERE file_shares.file_id = $1`,
            [fileId]
        );

        res.json({
            shares: result.rows
        });

    } catch (error) {
        console.error("Get shares error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// Share a file
app.post("/api/files/:id/share", authenticateToken, async (req, res) => {
    try {
        const fileId = req.params.id;
        const ownerId = req.user.id;
        const { recipientId, wrappedKey } = req.body;

        if (!recipientId || !wrappedKey) {
            return res.status(400).json({
                error: "Recipient and wrapped key are required"
            });
        }

        // Make sure the current user owns this file
        const fileCheck = await pool.query(
            "SELECT id FROM files WHERE id = $1 AND owner_id = $2",
            [fileId, ownerId]
        );

        if (fileCheck.rows.length === 0) {
            return res.status(404).json({
                error: "File not found or access denied"
            });
        }

        // Store the recipient's wrapped AES key
        await pool.query(
            `INSERT INTO file_shares
             (file_id, recipient_id, wrapped_key)
             VALUES ($1, $2, $3)
             ON CONFLICT (file_id, recipient_id)
             DO UPDATE SET wrapped_key = EXCLUDED.wrapped_key`,
            [fileId, recipientId, wrappedKey]
        );

        res.status(201).json({
            message: "File shared successfully"
        });

    } catch (error) {
        console.error("Share file error:", error);

        res.status(500).json({
            error: "Server error"
        });
    }
});

// Revoke access
app.delete(
    "/api/files/:id/shares/:recipientId",
    authenticateToken,
    async (req, res) => {
        try {
            const fileId = req.params.id;
            const recipientId = req.params.recipientId;
            const ownerId = req.user.id;

            // Make sure the current user owns this file
            const fileCheck = await pool.query(
                "SELECT id FROM files WHERE id = $1 AND owner_id = $2",
                [fileId, ownerId]
            );

            if (fileCheck.rows.length === 0) {
                return res.status(404).json({
                    error: "File not found or access denied"
                });
            }

            await pool.query(
                `DELETE FROM file_shares
                 WHERE file_id = $1
                 AND recipient_id = $2`,
                [fileId, recipientId]
            );

            res.json({
                message: "Access revoked successfully"
            });

        } catch (error) {
            console.error("Revoke share error:", error);

            res.status(500).json({
                error: "Server error"
            });
        }
    }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});