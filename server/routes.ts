import { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertBookSchema, insertBorrowSchema } from "@shared/schema";
import { v2 as cloudinary } from "cloudinary";
import { db } from "./db"; // Assuming the db instance is configured with drizzle-orm
import { users } from "@shared/schema"; // Assuming users schema is in the shared schema
import { eq } from "drizzle-orm"; // Import the eq method from drizzle-orm
import jwt from "jsonwebtoken"; // Importing JWT

cloudinary.config({
  cloud_name: "dgckkacgl",
  api_key: "928395724243498",
  api_secret: "V616OAx6j9C2S7NypodCvftAkCc",
});

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  function requireAuth(req: any, res: any, next: any) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }

  function requireAdmin(req: any, res: any, next: any) {
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  }

  // Books Routes
  app.get("/api/books", async (req, res) => {
    const books = await storage.getBooks();
    res.json(books);
  });

  app.get("/api/books/:id", async (req, res) => {
    const book = await storage.getBook(parseInt(req.params.id));
    if (!book) return res.status(404).json({ message: "Book not found" });
    res.json(book);
  });

  app.post("/api/books", requireAdmin, async (req, res) => {
    const parsed = insertBookSchema.parse(req.body);
    const book = await storage.createBook(parsed);
    res.status(201).json(book);
  });

  app.patch("/api/books/:id", requireAdmin, async (req, res) => {
    const parsed = insertBookSchema.partial().parse(req.body);
    const book = await storage.updateBook(parseInt(req.params.id), parsed);
    res.json(book);
  });

  app.delete("/api/books/:id", requireAdmin, async (req, res) => {
    await storage.deleteBook(parseInt(req.params.id));
    res.sendStatus(204);
  });

  // Borrows Routes
  app.get("/api/borrows", requireAuth, async (req, res) => {
    const borrows = await storage.getBorrows(req.user!.id);
    res.json(borrows);
  });

  app.post("/api/borrows", requireAuth, async (req, res) => {
    const { bookId, borrowDate, returnDate } = insertBorrowSchema
      .omit({ userId: true })
      .parse(req.body);
    const borrow = await storage.borrowBook(
      req.user!.id,
      bookId,
      borrowDate,
      returnDate
    );
    res.status(201).json(borrow);
  });

  app.post("/api/borrows/:id/return", requireAuth, async (req, res) => {
    await storage.returnBook(parseInt(req.params.id));
    res.sendStatus(204);
  });

  // Cloudinary signature
  app.post("/api/upload-signature", requireAdmin, (req, res) => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp },
      "V616OAx6j9C2S7NypodCvftAkCc"
    );
    res.json({
      timestamp,
      signature,
      apiKey: "928395724243498",
      cloudName: "dgckkacgl",
    });
  });

  // Authentication Routes

  // Register Route
  app.post("/api/auth/register", async (req, res) => {
    const { email, phone, password, repeatPassword } = req.body;

    // Validate password match
    if (password !== repeatPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, email)) // Use eq method for equality check
      .limit(1)
      .execute();

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Hash the password (you can use bcrypt or another hashing method here)
    const hashedPassword = await hashPassword(password);

    // Insert new user into the database
    await db
      .insert(users)
      .values({
        username: email, // Assuming email is the username
        phone,
        password: hashedPassword,
        isAdmin: false, // Default to false, change if necessary
      })
      .execute();

    res.status(201).json({ message: "User registered successfully" });
  });

  // Login Route
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    // Check if user exists
    const user = await db
      .select()
      .from(users)
      .where(eq(users.username, email)) // Use eq method for equality check
      .limit(1)
      .execute();

    if (!user || !isValidPassword(password, user[0].password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = generateJWT(user[0]);

    res.json({
      message: "Login successful",
      token,
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to hash password (using bcrypt)
async function hashPassword(password: string) {
  const bcrypt = require("bcrypt");
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Helper function to validate password
async function isValidPassword(password: string, hashedPassword: string) {
  const bcrypt = require("bcrypt");
  return await bcrypt.compare(password, hashedPassword);
}

// Helper function to generate JWT token
function generateJWT(user: any) {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: user.id, email: user.username }, "yourSecretKey", {
    expiresIn: "1h",
  });
}
