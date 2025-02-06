import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

// Set up Apollo Client
const client = new ApolloClient({
  link: createHttpLink({
    uri: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL, // Use your absolute Hasura GraphQL endpoint here
    fetch,
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET, // Replace with your Hasura admin secret
    },
  }),
  cache: new InMemoryCache(),
});

// GraphQL query to get all pictures
const GET_ALL_PICTURES = gql`
  query GetAllPictures {
    pictures(where: { category: { _eq: "videogames" } }) {
      id
      category
    }
  }
`;

// GraphQL mutation to insert multiple questions
const INSERT_QUESTIONS = gql`
  mutation InsertSimpleQuestions($objects: [simple_questions_insert_input!]!) {
    insert_simple_questions(objects: $objects) {
      returning {
        id
      }
    }
  }
`;

// Function to get all pictures
async function getAllPictures() {
  try {
    const { data } = await client.query({
      query: GET_ALL_PICTURES,
    });
    return data.pictures;
  } catch (error) {
    console.error('Error fetching pictures:', error);
    throw error;
  }
}

// Function to create unique combinations of images
async function createQuestions() {
  try {
    const pictures = await getAllPictures();
    const questions = [];

    // Generate questions for each picture
    for (let i = 0; i < pictures.length; i++) {
      for (let j = i + 1; j < pictures.length; j++) {
        questions.push({
          picture_1: pictures[i].id,
          picture_2: pictures[j].id,
          category: pictures[i].category || 'Uncategorized', // Use a default category if none exists
          is_active: false,
          question_state: "inactive",
          created_by_user_id: "the_intern"
        });
      }
    }

    // Insert questions into the simple_questions table
    await client.mutate({
      mutation: INSERT_QUESTIONS,
      variables: {
        objects: questions,
      },
    });

    console.log('All simple questions have been created successfully.');
  } catch (error) {
    console.error('Error creating simple questions:', error);
  }
}

// Update the main function
async function main() {
  await createQuestions();
}

main();
