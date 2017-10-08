import { Meteor } from 'meteor/meteor';
import { People } from '../imports/api/collections';

// insert a default document in the database; we're going to listen to changes to this person over time

Meteor.startup(() => {
  
  if (!People.findOne()) {
    People.insert({ _id: "userid1", name: "Michael Brook", eyeColor: "brown", occupation: "Programmer" });
  }

});