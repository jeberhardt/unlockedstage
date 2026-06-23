export interface NamedEvent {
  _id: string;
  _type: 'festival' | 'series';
  title: string;
  venue: string;
  neighbourhood?: string;
  dateTime?: string;
  schedule?: Array<{ startTime: string; endTime: string }>;
  externalLink?: string;
  genre?: string;
  notes?: string;
}

export interface Performance {
  _id: string;
  artist: string;
  dateTime: string;
  venue: string;
}

export interface EventDetail {
  event: NamedEvent & {
    instagramHandle?: string;
    facebookHandle?: string;
  };
  performances: Performance[];
}
