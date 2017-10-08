import { PubSub } from 'graphql-subscriptions';

// You can publish changes from anywhere as long as you include this file and call pubsub.publish(...)

export const pubsub = new PubSub();