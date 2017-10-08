import { WebApp } from 'meteor/webapp'; // Meteor-specific
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { createApolloServer, addCurrentUserToContext } from 'meteor/apollo'; // specific to Meteor, but you can always check out the Express implementation
import { makeExecutableSchema } from 'graphql-tools';
import resolvers from './resolvers'; // your custom resolvers
import typeDefs from './schema.graphql'; // your custom schema

// make schema executable
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// any additional context you use for your resolvers, if any
const context = {};

// start a graphql server with Express handling a possible Meteor current user
// if you're not using Meteor, check out https://github.com/apollographql/apollo-server for instructions on how to create a server in pure Node
createApolloServer({ 
  schema,
  context
}, {
  // // enable access to GraphQL API cross-domain (requires NPM "cors" package)
  // configServer: expressServer => expressServer.use(cors())
});

// create subscription server
// non-Meteor implementation here: https://github.com/apollographql/subscriptions-transport-ws
new SubscriptionServer({
  schema,
  execute,
  subscribe,
  // // on connect subscription lifecycle event
  // onConnect: async (connectionParams, webSocket) => {
  //   // if a meteor login token is passed to the connection params from the client, 
  //   // add the current user to the subscription context
  //   const subscriptionContext = connectionParams.authToken
  //     ? await addCurrentUserToContext(context, connectionParams.authToken)
  //     : context;
  //   return subscriptionContext;
  // }
}, {
  server: WebApp.httpServer,
  path: '/subscriptions'
});