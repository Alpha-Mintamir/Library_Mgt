import { users, books, borrows, type User, type InsertUser, type Book, type Borrow } from "@shared/schema";
import type { z } from "zod";
import { insertBookSchema } from "@shared/schema";

type InsertBook = z.infer<typeof insertBookSchema>;
import session from "express-session";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { nanoid } from 'nanoid';

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { isAdmin?: boolean }): Promise<User>;
  getAllUsers(): Promise<User[]>;

  getBooks(): Promise<Book[]>;
  getBook(id: number): Promise<Book | undefined>;
  createBook(book: InsertBook): Promise<Book>;
  updateBook(id: number, book: Partial<InsertBook>): Promise<Book>;
  deleteBook(id: number): Promise<void>;

  getBorrows(userId: number): Promise<Borrow[]>;
  borrowBook(userId: number, bookId: number, borrowDate: Date, returnDate: Date): Promise<Borrow>;
  returnBook(borrowId: number): Promise<void>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser & { isAdmin?: boolean }): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getBooks(): Promise<Book[]> {
    return await db.select().from(books);
  }

  async getBook(id: number): Promise<Book | undefined> {
    const [book] = await db.select().from(books).where(eq(books.id, id));
    return book;
  }

  async createBook(book: InsertBook): Promise<Book> {
    const [newBook] = await db.insert(books).values(book).returning();
    return newBook;
  }

  async updateBook(id: number, bookUpdate: Partial<InsertBook>): Promise<Book> {
    const [updated] = await db
      .update(books)
      .set(bookUpdate)
      .where(eq(books.id, id))
      .returning();

    if (!updated) throw new Error("Book not found");
    return updated;
  }

  async deleteBook(id: number): Promise<void> {
    return await db.transaction(async (tx) => {
      // First delete all associated borrows
      await tx.delete(borrows).where(eq(borrows.bookId, id));
      // Then delete the book
      await tx.delete(books).where(eq(books.id, id));
    });
  }

  async getBorrows(userId: number): Promise<Borrow[]> {
    return await db
      .select()
      .from(borrows)
      .where(eq(borrows.userId, userId));
  }

  async borrowBook(userId: number, bookId: number, borrowDate: Date, returnDate: Date): Promise<Borrow> {
    const book = await this.getBook(bookId);
    if (!book) throw new Error("Book not found");
    if (book.quantity < 1) throw new Error("Book not available");

    const borrowKey = nanoid(10);

    return await db.transaction(async (tx) => {
      await tx
        .update(books)
        .set({ quantity: book.quantity - 1 })
        .where(eq(books.id, bookId));

      const [borrow] = await tx
        .insert(borrows)
        .values({
          userId,
          bookId,
          borrowDate,
          returnDate,
          borrowKey,
          status: "pending",
        })
        .returning();

      return borrow;
    });
  }

  async returnBook(borrowId: number): Promise<void> {
    const [borrow] = await db
      .select()
      .from(borrows)
      .where(eq(borrows.id, borrowId));

    if (!borrow) throw new Error("Borrow record not found");
    if (borrow.status !== "pending") throw new Error("Book already returned");

    await db.transaction(async (tx) => {
      const [book] = await tx
        .select()
        .from(books)
        .where(eq(books.id, borrow.bookId));

      if (!book) throw new Error("Book not found");

      await tx
        .update(books)
        .set({ quantity: book.quantity + 1 })
        .where(eq(books.id, book.id));

      await tx
        .update(borrows)
        .set({ status: "returned", returnDate: new Date() })
        .where(eq(borrows.id, borrowId));
    });
  }
}

export const storage = new DatabaseStorage();