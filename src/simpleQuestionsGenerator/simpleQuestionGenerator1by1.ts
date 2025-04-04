import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new ApolloClient({
  link: createHttpLink({
    uri: process.env.NEXT_PUBLIC_HASURA_GRAPHQL_URL,
    fetch,
    headers: {
      'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
    },
  }),
  cache: new InMemoryCache(),
});

const GET_ALL_PICTURES = gql`
  query GetAllPictures {
    pictures(where: { category: { _eq: "videogames" } }) {
      id
      category
    }
  }
`;

const INSERT_SINGLE_QUESTION = gql`
  mutation InsertSingleQuestion($object: simple_questions_insert_input!) {
    insert_simple_questions_one(object: $object) {
      id
    }
  }
`;

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

async function insertSingleQuestion(question: any) {
  try {
    await client.mutate({
      mutation: INSERT_SINGLE_QUESTION,
      variables: {
        object: question,
      },
    });
    console.log(`✅ Success: Created question for pictures ${question.picture_1} and ${question.picture_2}`);
    return true;
  } catch (error) {
    console.log(`❌ Failed: Pictures ${question.picture_1} and ${question.picture_2}`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

async function createQuestionsOneByOne() {
  try {
    const pictures = await getAllPictures();
    let successCount = 0;
    let failureCount = 0;

    // Generate and insert questions one by one
    for (let i = 0; i < pictures.length; i++) {
      for (let j = i + 1; j < pictures.length; j++) {
        const question = {
          picture_1: pictures[i].id,
          picture_2: pictures[j].id,
          category: pictures[i].category || 'Uncategorized',
          is_active: false,
          question_state: "inactive",
          created_by_user_id: "the_intern",
          is_explicit_content: false
        };

        const success = await insertSingleQuestion(question);
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      }
    }

    console.log(`\nProcess completed:`);
    console.log(`Successfully created: ${successCount} questions`);
    console.log(`Failed to create: ${failureCount} questions`);
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

async function main() {
  await createQuestionsOneByOne();
}

main();
