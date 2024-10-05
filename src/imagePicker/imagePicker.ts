import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv'
import fs from 'fs';
import csv from 'csv-parser';
import readline from 'readline';

dotenv.config() // Load environment variables from .env file

interface Picture {
    id: string;
    image_url: string;
    name: string;
    category: string;
}

interface Config {
    numberOfQuestions: number;
    questions: any[]
}

interface Question {
    question_text: string;
    category: string;
    id: number;
    picture_1: string;
    picture_2: string;
}



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


const INSERT_QUESTIONS = gql`
    mutation InsertQuestions($questions: [questions_insert_input!]!) {
        insert_questions(objects: $questions) {
            returning {
                id
                question_text
            }
        }
    }
`;

// GraphQL query to get user rankings for a specific date
const GET_PICTURES = gql`
    query GetPictures {
        pictures {
            id
            image_url
            name
            category
        }
    }
`;

// GraphQL query to get questions from the last 7 days
const GET_RECENT_QUESTIONS = gql`
    query GetRecentQuestions($sevenDaysAgo: timestamptz!) {
        questions(where: { created_at: { _gte: $sevenDaysAgo } }) {
            id
            question_text
            date
            picture_1
            picture_2
        }
    }
`;

async function getPictures() {
    const { data } = await client.query({
        query: GET_PICTURES,
    });
    return data.pictures;
}

async function getRecentQuestions() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 1);

    const { data } = await client.query({
        query: GET_RECENT_QUESTIONS,
        variables: { sevenDaysAgo: sevenDaysAgo.toISOString() },
    });
    console.log("recent questions", data.questions);
    return data.questions;


}


function readConfigCsv(filePath: string): Promise<Config> {
    return new Promise((resolve, reject) => {
        const results: any[] = [];

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                const numberOfQuestions = parseInt(results[0]['Questions per day']);

                // remove "questions per day" from any questions inside results
                for (const question of results) {
                    delete question['Questions per day'];
                }

                resolve({numberOfQuestions, questions: results})

            })
            .on('error', (error) => reject(error));
    });
}

const generateQuestions = (pictures: Picture[]): Question[] => {
    const questions: Question[] = [];
    for (let i = 0; i < pictures.length; i++) {
        for (let j = i + 1; j < pictures.length; j++) {
            // Ensure pictures are from the same category and are not the same picture
            if (pictures[i].category === pictures[j].category && pictures[i].id !== pictures[j].id) {
                const question: Question = {
                    question_text: `${pictures[i].name} VS ${pictures[j].name}`,
                    category: pictures[i].category,
                    id: Math.floor(Math.random() * 1000000),
                    picture_1: pictures[i].id,
                    picture_2: pictures[j].id
                };
                questions.push(question);
            }
        }
    }
    return questions;
};

const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/\s+/g, '');
};

const selectQuestions = (questions: Question[], config: Config, recentQuestions: Question[]): Question[] => {
    const selectedQuestions: Question[] = [];
    const categoryLimits = config.questions.reduce((acc: any, q: any) => {
        acc[q.Catergory] = Math.floor(config.numberOfQuestions * parseFloat(q.Distribution));
        return acc;
    }, {});

    console.log("Category Limits:", categoryLimits); // Debug log

    const categoryCounts: any = {};
    let lastCategory = '';
    const selectedQuestionIds = new Set<number>(); // Track selected question IDs
    const recentQuestionTexts = new Set(recentQuestions.map(q => normalizeText(q.question_text))); // Track recent question texts

    while (selectedQuestions.length < config.numberOfQuestions) {
        const availableQuestions = questions.filter(q =>
            (categoryCounts[q.category] || 0) < categoryLimits[q.category] &&
            q.category !== lastCategory &&
            !selectedQuestionIds.has(q.id) && // Ensure uniqueness
            !recentQuestionTexts.has(normalizeText(q.question_text)) // Exclude recent questions
        );

        console.log("Available Questions:", availableQuestions.length); // Debug log

        if (availableQuestions.length === 0) break;

        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        const selectedQuestion = availableQuestions[randomIndex];

        selectedQuestions.push(selectedQuestion);
        selectedQuestionIds.add(selectedQuestion.id); // Add to the set of selected IDs
        categoryCounts[selectedQuestion.category] = (categoryCounts[selectedQuestion.category] || 0) + 1;
        lastCategory = selectedQuestion.category;
    }


    return selectedQuestions;
};

const promptUser = (questions: Question[]): Promise<{ action: string, date?: string }> => {
    return new Promise((resolve) => {
        console.log("Generated Questions:\n");
        questions.forEach((q, index) => {
            console.log(`${index + 1}. ${q.question_text}\n`);
        });

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question("Do you like it or want to regenerate some questions? (regenerate, keep): ", (answer) => {
            if (answer.trim().toLowerCase() === 'keep') {
                rl.question("When do you want to have these questions live (YYYY-MM-DD)? \n", (date) => {
                    rl.close();
                    resolve({ action: 'keep', date });
                });
            } else {
                rl.close();
                resolve({ action: answer });
            }
        });
    });
};

async function uploadQuestions(questions: Question[], liveDate: string) {
    const formattedQuestions = questions.map(q => ({
        question_text: q.question_text,
        picture_1: q.picture_1,
        picture_2: q.picture_2,
        date: liveDate
    }));

    try {
        const { data } = await client.mutate({
            mutation: INSERT_QUESTIONS,
            variables: { questions: formattedQuestions },
        });
        console.log('Uploaded Questions:', data.insert_questions.returning);
    } catch (error) {
        console.error('Error uploading questions:', error);
    }
}

const main = async () => {
    const pictures = await getPictures();
    const recentQuestions = await getRecentQuestions();
    const config = await readConfigCsv('src/imagePicker/config.csv');

    const sum = config.questions.reduce((acc, question) => acc + parseFloat(question['Distribution']), 0);
    if (sum !== 1) {
        throw new Error('The sum of the distribution is not 100%');
    }

    let allQuestions = generateQuestions(pictures);
    let dailyQuestions = selectQuestions(allQuestions, config, recentQuestions);

    while (true) {
        const userResponse = await promptUser(dailyQuestions);

        if (userResponse.action === 'keep') {
            await uploadQuestions(dailyQuestions, userResponse.date!);
            console.log("Questions uploaded successfully 🚀");
            break;
        }

        const regenerateIndices = userResponse.action.match(/\d+/g)?.map(Number) || [];
        regenerateIndices.forEach(index => {
            if (index > 0 && index <= dailyQuestions.length) {
                const availableQuestions = allQuestions.filter(q =>
                    q.category === dailyQuestions[index - 1].category &&
                    !dailyQuestions.some(dq => dq.id === q.id)
                );

                if (availableQuestions.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
                    dailyQuestions[index - 1] = availableQuestions[randomIndex];
                }
            }
        });
    }


};

main();
