import { ApolloClient, InMemoryCache, createHttpLink, gql } from '@apollo/client/core';
import { fetch } from 'cross-fetch';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

// Set up Apollo Client
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

const GET_QUESTIONS_WITH_COUNTS = gql`
  query GetQuestionsWithCounts($state: String!) {
    simple_questions(where: {question_state: {_eq: $state}}) {
      id
      category
      simple_user_answers_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`;

const UPDATE_QUESTION_STATE = gql`
  mutation UpdateQuestionState($questionIds: [bigint], $newState: String!) {
    update_simple_questions(
      where: {id: {_in: $questionIds}},
      _set: {question_state: $newState}
    ) {
      affected_rows
    }
  }
`;

async function getQuestionsWithAnswerCounts(currentState: string) {
  try {
    const { data } = await client.query({
      query: GET_QUESTIONS_WITH_COUNTS,
      variables: { state: currentState }
    });

    const questionsWithCounts = data.simple_questions.map((question: any) => ({
      questionId: question.id,
      category: question.category,
      answerCount: question.simple_user_answers_aggregate.aggregate.count
    }));

    // Sort by answer count for better visibility
    questionsWithCounts.sort((a, b) => b.answerCount - a.answerCount);

    return questionsWithCounts;
  } catch (error) {
    console.error('Error fetching questions with counts:', error);
    throw error;
  }
}

async function graduateQuestionsAboveThreshold(answerThreshold: number, currentState: string, newState: string, existingRl?: readline.Interface) {
  try {
    // First get all questions with their counts
    const questionsWithCounts = await getQuestionsWithAnswerCounts(currentState);
    
    // Filter questions above threshold
    const questionsToGraduate = questionsWithCounts.filter(q => q.answerCount >= answerThreshold);

    if (questionsToGraduate.length === 0) {
      console.log('No questions found above the threshold');
      return;
    }

    // Group questions by category
    const questionsByCategory = questionsToGraduate.reduce((acc, q) => {
      if (!acc[q.category]) {
        acc[q.category] = [];
      }
      acc[q.category].push(q);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('\nAvailable questions by category:');
    Object.entries(questionsByCategory).forEach(([category, questions]) => {
      console.log(`${category}: ${questions.length} questions available`);
    });

    // Use the existing readline interface if provided, otherwise create a new one
    const rl = existingRl || readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const selectedQuestionIds: number[] = [];

    // Create a promise-based question helper
    const askQuestion = (query: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(query, resolve);
      });
    };

    try {
      for (const [category, questions] of Object.entries(questionsByCategory)) {
        const answer = await askQuestion(
          `How many questions do you want to graduate from ${category}? (0-${questions.length}, press Enter for all): `
        );
        
        const count = answer === '' ? questions.length : parseInt(answer);
        
        if (isNaN(count) || count < 0 || count > questions.length) {
          console.log(`Invalid input for ${category}, skipping...`);
          continue;
        }

        // Take the specified number of questions from this category
        const selectedQuestions = questions.slice(0, count);
        selectedQuestionIds.push(...selectedQuestions.map(q => q.questionId));
      }

      if (selectedQuestionIds.length === 0) {
        console.log('No questions selected for graduation');
        rl.close();
        return;
      }

      console.log(`\nTotal questions selected: ${selectedQuestionIds.length}`);
      
      const proceed = await askQuestion('Do you want to proceed? (y/N): ');
      
      if (proceed.toLowerCase() === 'y') {
        const { data } = await client.mutate({
          mutation: UPDATE_QUESTION_STATE,
          variables: { questionIds: selectedQuestionIds, newState }
        });
        console.log(`Updated ${data.update_simple_questions.affected_rows} questions to "${newState}" state`);
        rl.close();
        return data.update_simple_questions.affected_rows;
      } else {
        console.log('Operation cancelled');
        rl.close();
        return 0;
      }
    } catch (error) {
      rl.close();
      throw error;
    }

    // Only close the readline interface if we created it
    if (!existingRl) {
      rl.close();
    }
  } catch (error) {
    console.error('Error graduating questions:', error);
    throw error;
  }
}

// Run main function if this file is being run directly
if (require.main === module) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Choose graduation type:\n1. inactive -> free\n2. free -> bet\nEnter (1 or 2): ', (gradType) => {
    if (!['1', '2'].includes(gradType)) {
      console.error('Please enter either 1 or 2');
      rl.close();
      return;
    }

    const currentState = gradType === '1' ? 'inactive' : 'free';
    const newState = gradType === '1' ? 'free' : 'bet';

    rl.question('Enter the answer threshold (default is 10): ', (input) => {
      const threshold = input ? parseInt(input) : 10;
      
      if (isNaN(threshold)) {
        console.error('Please enter a valid number');
        rl.close();
        return;
      }

      console.log(`\nFinding questions in state "${currentState}" with ${threshold} or more answers...`);
      
      graduateQuestionsAboveThreshold(threshold, currentState, newState, rl)
        .then(() => {
          console.log('Graduation process completed');
          rl.close();
        })
        .catch((error) => {
          console.error(error);
          rl.close();
        });
    });
  });
}

export { getQuestionsWithAnswerCounts, graduateQuestionsAboveThreshold };
