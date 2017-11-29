import { Template } from 'meteor/templating'; // Meteor-specific for frontend templating
import { ApolloClient } from 'apollo-client';
import { ApolloLink } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import WebSocketLink from 'apollo-link-ws';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { getOperationAST } from 'graphql';
import { setup } from 'meteor/swydo:blaze-apollo'; // Connects Apollo to Meteor's Blaze UI framework, but you can use React or Vue instead

import GET_PERSON from './graphql-queries/getPerson.graphql';
import GET_PERSON_SUBSCRIPTION from './graphql-queries/getPersonSubscription.graphql';
import UPDATE_PERSON from './graphql-queries/updatePerson.graphql';

import './main.html';



/* Initialize Apollo Client for GraphQL */

// You might want to set these manually if you're running your server somewhere else
const httpUri = Meteor.absoluteUrl('graphql'); // http://localhost:3000/graphql
const wsUri = Meteor.absoluteUrl('subscriptions').replace(/^http/, 'ws'); // ws://localhost:3000/subscriptions

// Apollo 2.0 now uses the extensible "ApolloLink" (the following does not rely on Meteor)

const link = ApolloLink.split(
  operation => {
  	const operationAST = getOperationAST(operation.query, operation.operationName);
  	return !!operationAST && operationAST.operation === 'subscription';
  },
  new WebSocketLink({
		uri: wsUri,
		options: {
			reconnect: true, // tells client to reconnect websocket after being disconnected (which will happen after a hot-reload)
      // // might be helpful if you want to carry login state from client
      // // it is recommended you use the secure version of websockets (wss) when transporting sensitive login information
			// connectionParams: {
			// 	authToken: localStorage.getItem("Meteor.loginToken")
			// }
		}
	}),
  new HttpLink({ uri: httpUri })
);

const cache = new InMemoryCache(window.__APOLLO_STATE);

const client = new ApolloClient({
  link,
  cache
});



//tie Apollo to Blaze UI with swydo:blaze-apollo Meteor package

setup({ client });



/* Our frontend code working with swydo:blaze-apollo (specific to Meteor); you'd typically place these in separate template files */

Template.body.onCreated(function bodyOnCreated() {
  
  // will automatically keep all queries to this person up-to-date because of Apollo's cache
  // it should be noted that apollo tracks cached entries by their ID, which is why we should have one in our schema
  // subscription will also be automatically unsubscribed when the template is destroyed, thanks to swydo:blaze-apollo
  
  this.gqlSubscribe({
    query: GET_PERSON_SUBSCRIPTION,
    variables: {
      id: "userid1" // id of user to subscribe to
    }
  });
  
  // this one will be referenced throughout the template as Template.instance().person
  
  this.person = this.gqlQuery({
    query: GET_PERSON,
    variables: {
      id: "userid1" // id of user to query
    }
  });

});

Template.body.helpers({
  
  person() {
    return Template.instance().person.get().person; // reactive data includes another "person" property
  }
  
});

Template.body.events({

	'submit form'(event, instance) {

		event.preventDefault();

		const $form = $(event.currentTarget);
    
    //put all input values in "values" object
    
    const values = {};
    
    $form.find('input').each(function() {
      values[this.name] = $(this).val();
    });
    
    values.id = "userid1"; // id of user to update, with all other data to update also in the object
    
    // gqlMutate returns a promise
    
    instance.gqlMutate({
      mutation: UPDATE_PERSON,
      variables: values // gets passed to our predefined graphql query as variables
    }).catch(error => {
      console.log(error);
      // console.log(error.name);
      // console.log(error.message);
      alert(error.message);
    });

	}
  
});
