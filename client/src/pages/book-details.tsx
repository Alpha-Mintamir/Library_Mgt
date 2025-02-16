import { useQuery, useMutation } from "@tanstack/react-query";
import { Book, Borrow, insertBorrowSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, BookOpen, CalendarIcon, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import QRCode from "qrcode";

export default function BookDetails() {
  const [location] = useLocation();
  const bookId = parseInt(location.split("/").pop() || "");
  const { user } = useAuth();
  const { toast } = useToast();
  const [borrowDate, setBorrowDate] = useState<Date>(new Date());
  const [returnDate, setReturnDate] = useState<Date>(addDays(new Date(), 14));
  const [qrCode, setQrCode] = useState<string>("");

  const { data: book, isLoading: isLoadingBook } = useQuery<Book>({
    queryKey: [`/api/books/${bookId}`],
  });

  const { data: borrows, isLoading: isLoadingBorrows } = useQuery<Borrow[]>({
    queryKey: ["/api/borrows"],
  });

  const hasActiveBorrow = borrows?.some(
    (borrow) => borrow.bookId === bookId && borrow.status === "pending"
  );

  const borrowMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/borrows", { 
        bookId,
        borrowDate,
        returnDate
      });
      const borrow = await res.json();

      // Generate QR code for the borrow key
      const qrCodeDataUrl = await QRCode.toDataURL(borrow.borrowKey);
      setQrCode(qrCodeDataUrl);

      return borrow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/borrows"] });
      queryClient.invalidateQueries({ queryKey: [`/api/books/${bookId}`] });
      toast({
        title: "Success",
        description: "Book borrowed successfully. Please show the QR code to the librarian.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoadingBook || isLoadingBorrows) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Book not found</h1>
        <Button asChild>
          <Link href="/">Go Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Books
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Book Cover */}
          <div className="aspect-[2/3] overflow-hidden rounded-lg border bg-muted">
            <img
              src={book.coverImage}
              alt={book.title}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Book Details */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h1 className="text-3xl font-bold">{book.title}</h1>
            </div>

            <div className="grid gap-4 mb-8">
              <div>
                <h3 className="font-medium mb-1">Authors</h3>
                <p className="text-muted-foreground">{book.authors}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-1">Genre</h3>
                  <p className="text-muted-foreground">{book.genre}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Language</h3>
                  <p className="text-muted-foreground">{book.language}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Publisher</h3>
                  <p className="text-muted-foreground">{book.publisher}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Year</h3>
                  <p className="text-muted-foreground">{book.year}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">Pages</h3>
                  <p className="text-muted-foreground">{book.pages}</p>
                </div>
                <div>
                  <h3 className="font-medium mb-1">ISBN</h3>
                  <p className="text-muted-foreground">{book.isbn}</p>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-1">Description</h3>
                <p className="text-muted-foreground">{book.description}</p>
              </div>

              <div>
                <h3 className="font-medium mb-1">Status</h3>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      book.quantity > 0 ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-muted-foreground">
                    {book.quantity} copies available
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Borrow Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !borrowDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {borrowDate ? format(borrowDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={borrowDate}
                      onSelect={(date) => date && setBorrowDate(date)}
                      disabled={(date) =>
                        date < new Date() || date > addDays(new Date(), 30)
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium">Return Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !returnDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {returnDate ? format(returnDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={returnDate}
                      onSelect={(date) => date && setReturnDate(date)}
                      disabled={(date) =>
                        date <= borrowDate || date > addDays(borrowDate, 30)
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {qrCode && (
              <div className="mb-4">
                <h3 className="font-medium mb-2">Your Borrow Code</h3>
                <div className="flex justify-center p-4 bg-white rounded-lg border">
                  <img src={qrCode} alt="Borrow QR Code" className="w-48 h-48" />
                </div>
                <p className="text-sm text-muted-foreground text-center mt-2">
                  Please show this QR code to the librarian when picking up your book
                </p>
              </div>
            )}

            {!user?.isAdmin && (
              <Button
                className="w-full"
                disabled={
                  borrowMutation.isPending ||
                  book.quantity === 0 ||
                  hasActiveBorrow ||
                  !borrowDate ||
                  !returnDate
                }
                onClick={() => borrowMutation.mutate()}
              >
                {borrowMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {hasActiveBorrow
                  ? "Already Borrowed"
                  : book.quantity === 0
                  ? "Not Available"
                  : "Borrow Book"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}