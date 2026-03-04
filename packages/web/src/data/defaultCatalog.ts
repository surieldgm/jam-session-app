import type { Genre } from "../types";

export interface CatalogEntry {
  title: string;
  artist: string;
  genre: Genre;
  youtubeUrl?: string;
}

export const defaultCatalog: CatalogEntry[] = [
  // Jazz Standards
  { title: "Watermelon Man", artist: "Herbie Hancock", genre: "jazz", youtubeUrl: "https://www.youtube.com/watch?v=4bjPlBC4h_8" },
  { title: "Cantaloupe Island", artist: "Herbie Hancock", genre: "jazz", youtubeUrl: "https://www.youtube.com/watch?v=8B1oIXGX0Io" },
  { title: "Autumn Leaves", artist: "Standard", genre: "jazz" },
  { title: "Blue Monk", artist: "Thelonious Monk", genre: "jazz" },
  { title: "Take Five", artist: "Dave Brubeck", genre: "jazz" },
  { title: "So What", artist: "Miles Davis", genre: "jazz" },
  { title: "All Blues", artist: "Miles Davis", genre: "jazz" },
  { title: "Freddie Freeloader", artist: "Miles Davis", genre: "jazz" },
  { title: "Fly Me to the Moon", artist: "Standard", genre: "jazz" },
  { title: "Summertime", artist: "Standard", genre: "jazz" },
  { title: "Stella by Starlight", artist: "Standard", genre: "jazz" },
  { title: "All the Things You Are", artist: "Standard", genre: "jazz" },
  { title: "Blue Bossa", artist: "Kenny Dorham", genre: "jazz" },
  { title: "Footprints", artist: "Wayne Shorter", genre: "jazz" },
  { title: "Maiden Voyage", artist: "Herbie Hancock", genre: "jazz" },
  { title: "Song for My Father", artist: "Horace Silver", genre: "jazz" },
  { title: "Misty", artist: "Erroll Garner", genre: "jazz" },
  { title: "Round Midnight", artist: "Thelonious Monk", genre: "jazz" },
  { title: "A Night in Tunisia", artist: "Dizzy Gillespie", genre: "jazz" },
  { title: "My Favorite Things", artist: "John Coltrane", genre: "jazz" },

  // Blues
  { title: "The Thrill Is Gone", artist: "B.B. King", genre: "blues" },
  { title: "Stormy Monday", artist: "T-Bone Walker", genre: "blues" },
  { title: "Red House", artist: "Jimi Hendrix", genre: "blues" },
  { title: "Blues for Alice", artist: "Charlie Parker", genre: "blues" },
  { title: "Billie's Bounce", artist: "Charlie Parker", genre: "blues" },
  { title: "Straight No Chaser", artist: "Thelonious Monk", genre: "blues" },

  // Funk
  { title: "Chameleon", artist: "Herbie Hancock", genre: "funk", youtubeUrl: "https://www.youtube.com/watch?v=UbkqE4fpvdI" },
  { title: "The Chicken", artist: "Jaco Pastorius", genre: "funk" },
  { title: "Pick Up the Pieces", artist: "Average White Band", genre: "funk" },
  { title: "Ain't No Stoppin' Us Now", artist: "McFadden & Whitehead", genre: "funk" },
  { title: "Superstition", artist: "Stevie Wonder", genre: "funk" },
  { title: "Sir Duke", artist: "Stevie Wonder", genre: "funk" },

  // Groove
  { title: "Cissy Strut", artist: "The Meters", genre: "groove" },
  { title: "Use Me", artist: "Bill Withers", genre: "groove" },
  { title: "Lovely Day", artist: "Bill Withers", genre: "groove" },
  { title: "Isn't She Lovely", artist: "Stevie Wonder", genre: "groove" },
  { title: "I Wish", artist: "Stevie Wonder", genre: "groove" },

  // Latin
  { title: "Oye Como Va", artist: "Tito Puente", genre: "latin" },
  { title: "Black Orpheus", artist: "Luiz Bonfá", genre: "latin" },
  { title: "The Girl from Ipanema", artist: "Tom Jobim", genre: "latin" },
  { title: "Desafinado", artist: "Tom Jobim", genre: "latin" },
  { title: "Bésame Mucho", artist: "Consuelo Velázquez", genre: "latin" },
  { title: "Samba de Uma Nota Só", artist: "Tom Jobim", genre: "latin" },
  { title: "Mas Que Nada", artist: "Jorge Ben Jor", genre: "latin" },
  { title: "Spain", artist: "Chick Corea", genre: "latin" },
];
