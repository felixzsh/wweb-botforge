export interface BotConfiguration {
  id: string;
  name: string;
  phone?: string;
  auto_responses?: any[];
  webhooks?: any[];
  settings?: any;
}


// TODO: configfile entity class that will serve to represent
// what a config file shoould have, for now yaml config will
// be implemented ininfrastructure, but here this class 
// will contain only domain related representation
// this entity will have as list of botconfigs,
// and some main properties related to the
// whole botforge, for example the path of chromium bin




