import festival    from './festival'
import performance from './performance'
import series      from './series'
import source      from './source'
import event       from './event'       // kept during migration — remove once all event docs are migrated

export const schemaTypes = [festival, performance, series, source, event]
