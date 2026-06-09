export default {
  name: 'event',
  title: 'Event',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
    },
    {
      name: 'artist',
      title: 'Artist Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'genre',
      title: 'Genre',
      type: 'string',
      options: {
        list: [
          { title: 'Jazz',       value: 'jazz' },
          { title: 'Indie',      value: 'indie' },
          { title: 'Classical',  value: 'classical' },
          { title: 'Folk',       value: 'folk' },
          { title: 'Electronic', value: 'electronic' },
          { title: 'R&B',        value: 'rb' },
          { title: 'Pop',        value: 'pop' },
          { title: 'Hip-Hop',    value: 'hiphop' },
          { title: 'Other',      value: 'other' },
        ],
        layout: 'radio',
      },
      validation: Rule => Rule.required(),
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
      title: 'Venue Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'neighbourhood',
      title: 'Neighbourhood',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
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
          prepare: ({ start, end }) => ({ title: `${start?.slice(0,10)} ${start?.slice(11,16)} – ${end?.slice(11,16)}` }),
        },
      }],
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
      name: 'eventPostedToSocial',
      title: 'Event Posted to Social',
      type: 'boolean',
      description: 'Set when this event has been posted as a named-event/festival post.',
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
      title: 'artist',
      subtitle: 'venue',
      media: 'image',
    },
  },
}