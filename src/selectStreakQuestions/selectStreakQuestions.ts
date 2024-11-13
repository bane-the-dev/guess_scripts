import { ApolloClient, InMemoryCache, createHttpLink, gql } from '@apollo/client/core';
import { fetch } from 'cross-fetch';
import dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config()

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

export interface StreakQuestion {
  id: number;
  picture1: string;
  picture2: string;
  category: string | null;
  answerCount: number;
  odds: number;
}

export const GET_STREAK_QUESTIONS = gql`
  query GetStreakQuestions {
    simple_questions(
      where: {is_active: {_eq: false}}
    ) {
      id
      picture_1
      picture_2
      category
      simple_user_answers_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`;

export const UPDATE_QUESTIONS_ACTIVE_STATUS = gql`
  mutation UpdateQuestionsActiveStatus($questionIds: [bigint!]!) {
    update_simple_questions(
      where: {id: {_in: $questionIds}}, 
      _set: {is_active: true}
    ) {
      affected_rows
    }
  }
`;

export const GET_QUESTIONS_COUNT = gql`
  query GetQuestionsCount {
    active: simple_questions_aggregate(where: {is_active: {_eq: true}}) {
      aggregate {
        count
      }
    }
    inactive: simple_questions_aggregate(where: {is_active: {_eq: false}}) {
      aggregate {
        count
      }
    }
    categories: simple_questions(distinct_on: category) {
      category
    }
    active_by_category: simple_questions(where: {is_active: {_eq: true}}) {
      category
    }
    inactive_by_category: simple_questions(where: {is_active: {_eq: false}}) {
      category
    }
  }
`;

export const selectStreakQuestions = async () => {
  // Add threshold prompt before fetching questions
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const threshold = await new Promise<number>(resolve => {
    rl.question('\nEnter minimum answer count threshold (default: 0): ', (answer) => {
      const parsed = parseInt(answer);
      resolve(isNaN(parsed) ? 0 : parsed);
    });
  });

  const { data } = await client.query({
    query: GET_STREAK_QUESTIONS,
  });

  // Group questions by category
  const questionsByCategory = data.simple_questions.reduce((acc: { [key: string]: any[] }, question: any) => {
    const category = question.category || 'uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({
      id: question.id,
      picture1: question.picture_1,
      picture2: question.picture_2,
      category: question.category,
      answerCount: question?.simple_user_answers_aggregate?.aggregate?.count || 0,
    });
    return acc;
  }, {});

  // Sort each category by answer count and take top 50
  const topQuestionsByCategory = Object.entries(questionsByCategory).reduce((acc: { [key: string]: any[] }, [category, questions]) => {
    acc[category] = questions
      .filter(q => q.answerCount >= threshold)  // Add threshold filter
      .sort((a, b) => b.answerCount - a.answerCount)
      .slice(0, 50);
    return acc;
  }, {});

  // Calculate and print statistics for each category
  let totalOdds = 0;
  let totalQuestions = 0;

  Object.entries(topQuestionsByCategory).forEach(([category, questions]) => {
    if (questions && questions.length > 0) {
      const avgOdds = questions.reduce((sum, q) => sum + q.odds, 0) / questions.length;
      totalOdds += questions.reduce((sum, q) => sum + q.odds, 0);
      totalQuestions += questions.length;

      console.log(`\n${category.toUpperCase()}:`);
      console.log(`Total questions: ${questions.length}`);
      console.log(`Answer count range: ${questions[questions.length - 1]?.answerCount || 0} - ${questions[0]?.answerCount || 0}`);
      console.log(`Average odds: ${avgOdds.toFixed(2)}`);
    }
  });

  // Calculate and print overall statistics
  console.log(`\nOVERALL STATISTICS:`);
  console.log(`Total questions across all categories: ${totalQuestions}`);
  console.log(`Average odds across all questions: ${totalQuestions > 0 ? (totalOdds / totalQuestions).toFixed(2) : '0.00'}`);

  // New section for category-by-category confirmation
  let finalQuestionIds: number[] = [];

  for (const [category, questions] of Object.entries(topQuestionsByCategory)) {
    if (questions && questions.length > 0) {
      const categoryAnswer = await new Promise<string>(resolve => {
        rl.question(`\nActivate ${questions.length} questions for ${category}? (y/N) `, resolve);
      });

      if (categoryAnswer.toLowerCase() === 'y') {
        finalQuestionIds.push(...questions.map(q => q.id));
        console.log(`Added ${questions.length} questions from ${category} to activation list`);
      }
    }
  }

  rl.close();

  if (finalQuestionIds.length > 0) {
    try {
      const { data: mutationData } = await client.mutate({
        mutation: UPDATE_QUESTIONS_ACTIVE_STATUS,
        variables: {
          questionIds: finalQuestionIds
        }
      });

      console.log(`\nActivated ${mutationData.update_streak_questions.affected_rows} questions`);
    } catch (error) {
      console.error('Error updating questions active status:', error);
    }
  } else {
    console.log('\nNo categories selected. No questions were activated.');
  }

  return topQuestionsByCategory;
};

async function main() {
  try {
    const { data: countData } = await client.query({
      query: GET_QUESTIONS_COUNT,
    });
    
    console.log('\nCurrent Question Status:');
    console.log(`Total active questions: ${countData.active.aggregate.count}`);
    console.log(`Total inactive questions: ${countData.inactive.aggregate.count}`);
    console.log('\nBreakdown by Category:');
    
    // Get unique categories
    const categories = countData.categories
      .map((c: any) => c.category || 'uncategorized')
      .filter((c: string) => c);

    // Count questions by category
    categories.forEach((category: string) => {
      const activeCount = countData.active_by_category
        .filter((q: any) => (q.category || 'uncategorized') === category).length;
      const inactiveCount = countData.inactive_by_category
        .filter((q: any) => (q.category || 'uncategorized') === category).length;
      
      console.log(`\n${category.toUpperCase()}:`);
      console.log(`  Active: ${activeCount}`);
      console.log(`  Inactive: ${inactiveCount}`);
    });
    
    console.log('\n-----------------------------------\n');

    const questions = await selectStreakQuestions();
  } catch (error) {
    console.error('Error fetching streak questions:', error);
  }
}

// Run main function if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}
