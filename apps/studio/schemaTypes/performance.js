const genreOptions = [
  { title: 'Jazz',       value: 'jazz' },
  { title: 'Indie',      value: 'indie' },
  { title: 'Classical',  value: 'classical' },
  { title: 'Folk',       value: 'folk' },
  { title: 'Electronic', value: 'electronic' },
  { title: 'R&B',        value: 'rb' },
  { title: 'Pop',        value: 'pop' },
  { title: 'Hip-Hop',    value: 'hiphop' },
  { title: 'Other',      value: 'other' },
]

export default {
  name: 'performance',
  title: 'Performance',
  type: 'document',
  fields: [
    {
      name: 'artist',
      title: 'Artist',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'festival',
      title: 'Festival / Event',
      type: 'reference',
      to: [{ type: 'festival' }],
      description: 'Link to the parent festival or named event, if applicable.',
    },
    {
      name: 'genre',
      title: 'Genre',
      type: 'string',
      options: { list: genreOptions, layout: 'radio' },
    },
    {
      name: 'dateTime',
      title: 'Date & Time',
      type: 'datetime',
      options: { dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm', timeStep: 15 },
      validation: Rule => Rule.required(),
    },
    {
      name: 'venue',
      title: 'Venue',
      type: 'string',
      description: 'Specific venue for this performance. If part of a festival, can differ from the festival venue.',
    },
    {
      name: 'neighbourhood',
      title: 'Neighbourhood',
      type: 'string',
    },
    {
      name: 'externalLink',
      title: 'External Link',
      type: 'url',
    },
    {
      name: 'notes',
      title: 'Notes',
      type: 'text',
      rows: 3,
    },
    {
      name: 'postedToSocial',
      title: 'Posted to Social',
      type: 'boolean',
      description: 'Set automatically when this performance has been posted as an individual post.',
    },
  ],
  orderings: [
    {
      title: 'Date, soonest first',
      name: 'dateAsc',
      by: [{ field: 'dateTime', direction: 'asc' }],
    },
  ],
  preview: {
    select: {
      title:    'artist',
      festival: 'festival.title',
      venue:    'venue',
      dateTime: 'dateTime',
    },
    prepare: ({ title, festival, venue, dateTime }) => ({
      title,
      subtitle: [festival, venue, dateTime?.slice(0, 10)].filter(Boolean).join(' · '),
    }),
  },
}
