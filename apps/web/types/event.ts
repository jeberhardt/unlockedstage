export interface Event {
  _id: string;
  title?: string;
  artist: string;
  genre: string;
  dateTime: string;
  venue: string;
  neighbourhood: string;
  externalLink?: string;
  notes?: string;
  image?: {
    asset: {
      _ref: string;
    };
  };
}
