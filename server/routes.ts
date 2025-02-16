import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { insertBookSchema } from "@shared/schema";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

  // Books
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

  // Borrows
  app.get("/api/borrows", requireAuth, async (req, res) => {
    const borrows = await storage.getBorrows(req.user.id);
    res.json(borrows);
  });

  app.post("/api/borrows", requireAuth, async (req, res) => {
    const { bookId, borrowDate, returnDate } = insertBorrowSchema.parse(req.body);
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
      process.env.CLOUDINARY_API_SECRET!
    );
    res.json({ timestamp, signature, apiKey: process.env.CLOUDINARY_API_KEY, cloudName: process.env.CLOUDINARY_CLOUD_NAME });
  });

  const httpServer = createServer(app);
  return httpServer;
}