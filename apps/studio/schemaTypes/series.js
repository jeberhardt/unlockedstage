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
  name: 'series',
  title: 'Series',
  type: 'document',
  description: 'A recurring program or concert series. Individual performances link back to this document.',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Name of the series (e.g. "Hamilton Public Library Noon Hour Concerts")',
      validation: Rule => Rule.required(),
    },
    {
      name: 'genre',
      title: 'Genre',
      type: 'string',
      options: { list: genreOptions, layout: 'radio' },
    },
    {
      name: 'venue',
      title: 'Venue',
      type: 'string',
      description: 'Typical or home venue for this series.',
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
      name: 'instagramHandle',
      title: 'Instagram Handle',
      type: 'string',
      description: 'e.g. @hamiltonlibrary',
    },
    {
      name: 'facebookHandle',
      title: 'Facebook Handle',
      type: 'string',
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    },
  ],
  orderings: [
    {
      title: 'Title A–Z',
      name: 'titleAsc',
      by: [{ field: 'title', direction: 'asc' }],
    },
  ],
  preview: {
    select: {
      title:    'title',
      subtitle: 'venue',
      media:    'image',
    },
  },
}
