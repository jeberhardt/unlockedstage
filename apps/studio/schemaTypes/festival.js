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
  name: 'festival',
  title: 'Festival / Named Event',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'genre',
      title: 'Genre',
      type: 'string',
      options: { list: genreOptions, layout: 'radio' },
      validation: Rule => Rule.required(),
    },
    {
      name: 'venue',
      title: 'Venue',
      type: 'string',
      description: 'General venue or area (e.g. "Dundas Street West", "25+ locations across Toronto")',
      validation: Rule => Rule.required(),
    },
    {
      name: 'neighbourhood',
      title: 'Neighbourhood',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'dateTime',
      title: 'Start Date / Time',
      type: 'datetime',
      description: 'Used when no schedule entries are defined.',
      options: { dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm', timeStep: 15 },
      validation: Rule => Rule.required(),
    },
    {
      name: 'schedule',
      title: 'Schedule',
      description: 'Per-day schedule for multi-day events.',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'startTime', title: 'Start', type: 'datetime', options: { dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm', timeStep: 15 } },
          { name: 'endTime',   title: 'End',   type: 'datetime', options: { dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm', timeStep: 15 } },
        ],
        preview: {
          select: { start: 'startTime', end: 'endTime' },
          prepare: ({ start, end }) => ({ title: `${start?.slice(0, 10)}  ${start?.slice(11, 16)} – ${end?.slice(11, 16)}` }),
        },
      }],
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
      rows: 4,
    },
    {
      name: 'instagramHandle',
      title: 'Instagram Handle',
      type: 'string',
      description: 'e.g. @dowestfest',
    },
    {
      name: 'facebookHandle',
      title: 'Facebook Handle',
      type: 'string',
      description: 'e.g. @dowestfest',
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
    },
    {
      name: 'eventPostedToSocial',
      title: 'Posted to Social',
      type: 'boolean',
      description: 'Set automatically when this event has been posted as a festival/named-event post.',
    },
    {
      name: 'cancelled',
      title: 'Cancelled',
      type: 'boolean',
      description: 'Check this to flag the event as cancelled (e.g. bad weather). Run post-cancelled-events.js to alert followers.',
    },
    {
      name: 'cancellationPosted',
      title: 'Cancellation Posted',
      type: 'boolean',
      description: 'Set automatically once a cancellation alert has been posted for this event.',
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
      title:     'title',
      subtitle:  'venue',
      media:     'image',
      cancelled: 'cancelled',
    },
    prepare: ({ title, subtitle, media, cancelled }) => ({
      title: cancelled ? `❌ CANCELLED — ${title}` : title,
      subtitle,
      media,
    }),
  },
}
