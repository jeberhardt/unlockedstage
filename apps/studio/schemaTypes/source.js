export default {
  name: 'source',
  title: 'Source',
  type: 'document',
  fields: [
    {
      name: 'venue',
      title: 'Venue / Series Name',
      type: 'string',
      validation: Rule => Rule.required(),
    },
    {
      name: 'url',
      title: 'URL',
      type: 'url',
      validation: Rule => Rule.required(),
    },
    {
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
    },
    {
      name: 'neighbourhood',
      title: 'Neighbourhood',
      type: 'string',
    },
    {
      name: 'active',
      title: 'Active',
      type: 'boolean',
      initialValue: true,
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
  ],
  preview: {
    select: {
      title: 'venue',
      subtitle: 'neighbourhood',
    },
  },
}
