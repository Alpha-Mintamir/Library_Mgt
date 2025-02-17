import { pgTable, text, serial, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  phone: text("phone").notNull()
});

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  isbn: text("isbn").notNull(),
  authors: text("authors").notNull(),
  genre: text("genre").notNull(),
  pages: integer("pages").notNull(),
  year: integer("year").notNull(),
  language: text("language").notNull(),
  publisher: text("publisher").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  coverImage: text("cover_image").notNull(),
});

export const borrows = pgTable("borrows", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id),
  borrowDate: timestamp("borrow_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  borrowKey: text("borrow_key").notNull().unique(),
  status: text("status").notNull().default("pending"),
});


export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  phone: true,  // Added phone field in the schema
});

export const insertBookSchema = createInsertSchema(books);
export const insertBorrowSchema = createInsertSchema(borrows)
  .omit({ borrowKey: true, status: true } as const)
  .extend({
    borrowDate: z.coerce.date(),
    returnDate: z.coerce.date(),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Book = typeof books.$inferSelect;
export type Borrow = typeof borrows.$inferSelect;
