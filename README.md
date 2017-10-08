# Apollo 2.0 with GraphQL + subscriptions
An example showing how to use Apollo 2.0 with GraphQL server + subscriptions *(working as of Oct. 7, 2017)*

Some of the frontend and server-side components use Meteor, but there are comments each step of the way which should help you switch it to a different framework, whether that's React or Vue on the client or just Express on the server.

I made this because, right now, Apollo is shifting to 2.0 and it has brought many breaking changes to applications that used to work with 1.0. The official docs and most examples online are not yet up-to-date, and it took me several hours of hunting through forums to get something working with the newest Apollo.

## How to Run
Clone this repo. If you don't already have Meteor, see https://www.meteor.com/install or just run:

```
curl https://install.meteor.com/ | sh
```

Then in your project directory, run:

```
meteor npm install
meteor
```

Open up http://localhost:3000/ and see the result.

![meteor-apollo2 screenshot](https://raw.githubusercontent.com/Pitchlyapp/meteor-apollo2/master/imgs/meteor-apollo2.png)

When you update the values on the bottom, the changes should reflect immediately up above. If you open the page in two separate windows, changes in one window should push up to all windows as well, right away. This is GraphQL subscriptions at work using the new extensible **ApolloLink** interface in Apollo 2.0.

## Dependencies
This example includes all necessary dependencies, but if you are building from scratch, the dependencies are very particular. Having the wrong package versions is a common source of error.

#### NPM
```
npm install --save apollo-client@beta apollo-cache-inmemory@beta apollo-link@0.7.0 apollo-link-http@0.7.0 apollo-link-ws@0.5.0 graphql-subscriptions subscriptions-transport-ws apollo-server-express express graphql graphql-tools body-parser
```
(If using Meteor, remember to prepend "meteor" before npm)

#### Meteor
```
meteor add apollo swydo:blaze-apollo swydo:graphql webapp
```
(If you're using React or Vue, feel free to use something other than [`swydo:blaze-apollo`](https://github.com/Swydo/blaze-apollo))

## Files of Interest
With the removal of **SubscriptionManager** and the move from **networkInterface** to **ApolloLink**, most changes have taken place on the client side.

### Client
The client now looks something like this:

```javascript
import { ApolloClient } from 'apollo-client';
import { ApolloLink } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import WebSocketLink from 'apollo-link-ws';
import Cache from 'apollo-cache-inmemory';
import { getOperationAST } from 'graphql';

const httpUri = 'http://localhost:3000/graphql';
const wsUri = 'ws://localhost:3000/subscriptions';

const link = ApolloLink.split(
  operation => {
    const operationAST = getOperationAST(operation.query, operation.operationName);
    return !!operationAST && operationAST.operation === 'subscription';
  },
  new WebSocketLink({
    uri: wsUri,
    options: {
      reconnect: true, //auto-reconnect
      // // carry login state (should use secure websockets (wss) when using this)
      // connectionParams: {
      //   authToken: localStorage.getItem("Meteor.loginToken")
      // }
    }
  }),
  new HttpLink({ uri: httpUri })
);

const cache = new Cache(window.__APOLLO_STATE);

const client = new ApolloClient({
  link,
  cache
});
```

### Server

```javascript
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
```

#### Resolvers
Here is a quick peek at our resolvers. There aren't many changes here, but if you are new to subscriptions, you can see them in action on the server here.

```javascript
import { withFilter } from 'graphql-subscriptions'; // will narrow down the changes subscriptions listen to
import { pubsub } from './subscriptions'; // import pubsub object for subscriptions to work
import { People } from '../imports/api/collections'; // Meteor-specific for doing database queries

const resolvers = {
  
  Query: {
    person(obj, args, context) {
      const person = People.findOne(args.id);
      if (person) {
        // Mongo stores id as _id, but our GraphQL API calls for id, so make it conform to the API
        person.id = person._id;
        delete person._id;
      }
      return person;
    }
  },
  
  Mutation: {
    updatePerson(obj, args, context) {
      // You'll probably want to validate the args first in production, and possibly check user credentials using context
      People.update({ _id: args.id }, { $set: { name: args.name, eyeColor: args.eyeColor, occupation: args.occupation } });
      pubsub.publish("personUpdated", { personUpdated: args }); // trigger a change to all subscriptions to this person
      // Note: You must publish the object with the subscription name nested in the object!
      // See: https://github.com/apollographql/graphql-subscriptions/issues/51
      return args;
    }
  },
  
  Subscription: {
    personUpdated: {
      // See: https://github.com/apollographql/graphql-subscriptions#channels-mapping
      // Take a look at "Channels Mapping" for handling multiple create, update, delete events
      // Also, check out "PubSub Implementations" for using Redis instead of PubSub
      // PubSub is not recommended for production because it won't work if you have multiple servers
      // withFilter makes it so you can only listen to changes to this person instead of all people
      subscribe: withFilter(() => pubsub.asyncIterator('personUpdated'), (payload, args) => {
        return (payload.personUpdated.id===args.id);
      })
    }
  }
  
};

export default resolvers;
```

#### Note
Something that is important to understand with GraphQL publish and subscribe is that you must manually **publish** every time a change was made on the server. That is how updates are pushed to the client immediately. (Meteor folks may not be used to this, since they've always gotten this for free.) This example will work if you are only making changes to your data through GraphQL mutations, but if you have changes coming in from elsewhere as well, you'll want to call `pubsub.publish("exampleSub", { exampleSub: data });` wherever those changes are made, where `exampleSub` is the name of your subscription and `data` is your complete object for that entity as it adheres to your GraphQL schema (in this case, it is all data belonging to that **Person**).

## GraphiQL
Lest we forget, we also have GraphiQL at our disposal for query testing. If you open up your browser to http://localhost:3000/graphiql you can inspect your schema more easily. Try running queries like the one below.

```graphql
query {
  person(id: "userid1") {
    id
    name
    eyeColor
    occupation
  }
}
```

## About Pitchly
My name is Michael and I'm a Senior Product Engineer at [Pitchly](https://pitchly.net/). We make it easy to manage and find information instantly across your entire organization and export that information into a variety of visual formats. Meteor, GraphQL, and Apollo are a large part of what we use. We're also from Des Moines, Iowa. Sure it snows here, but we also have some pretty awesome corn!

If you have any questions about this example or if you have a passion for GraphQL or Meteor, [get a hold of us](mailto:jobs@pitchly.net). **We're hiring!**

![Pitchly](https://raw.githubusercontent.com/Pitchlyapp/meteor-apollo2/master/imgs/logo.png)

[Website](https://pitchly.net/) - [Twitter](https://twitter.com/pitchlyinc) - [LinkedIn](https://www.linkedin.com/company/pitchly)