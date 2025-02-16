import { useQuery } from "@tanstack/react-query";
import { Book } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { LogOut, Search, Loader2, BookOpen } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string>("all");

  const { data: books, isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const filteredBooks = books?.filter((book) => {
    const matchesSearch = book.title.toLowerCase().includes(search.toLowerCase()) ||
                         book.authors.toLowerCase().includes(search.toLowerCase());
    const matchesGenre = genre === "all" || book.genre === genre;
    return matchesSearch && matchesGenre;
  });

  const uniqueGenres = Array.from(new Set(books?.map((book) => book.genre) || []));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            <h1 className="text-xl font-semibold">LibrarySystem</h1>
          </div>

          <div className="flex items-center gap-4">
            {user?.isAdmin && (
              <Button variant="outline" asChild>
                <Link href="/admin/books">Manage Books</Link>
              </Button>
            )}
            <Button 
              variant="ghost" 
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-8 flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Input
              placeholder="Search books..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10"
            />
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          </div>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {uniqueGenres.map((genre) => (
                <SelectItem key={genre} value={genre}>
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Books Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredBooks?.map((book) => (
              <Link key={book.id} href={`/books/${book.id}`}>
                <div className="group cursor-pointer">
                  <div className="aspect-[2/3] mb-3 overflow-hidden rounded-lg border bg-muted">
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="font-medium line-clamp-1">{book.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {book.authors}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${book.quantity > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-muted-foreground">
                      {book.quantity > 0 ? 'Available' : 'Borrowed'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}