import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { ApolloClient, InMemoryCache, gql } from '@apollo/client/core';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

// Set up S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

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

// GraphQL mutation to insert pictures
const INSERT_PICTURE = gql`
  mutation InsertPicture($objects: [pictures_insert_input!]!) {
    insert_pictures(objects: $objects) {
      returning {
        id
        image_url
        name
        category
      }
    }
  }
`;

async function uploadImagesToS3AndDatabase(folderPath: string) {
  try {
    // Extract category from folder path
    const category = path.basename(folderPath);
    
    const files = await readdir(folderPath);
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );

    console.log(`Found ${imageFiles.length} images to upload`);

    const picturesData = [];

    for (const file of imageFiles) {
      try {
        const filePath = path.join(folderPath, file);
        const fileContent = await readFile(filePath);
        const fileExtension = path.extname(file);
        const timestamp = Date.now();
        
        const s3Key = `images/${category}/${timestamp}-${file}`;
        
        const params = {
          Bucket: process.env.AWS_BUCKET_NAME!,
          Key: s3Key,
          Body: fileContent,
          ContentType: `image/${fileExtension.substring(1)}`,
        };

        await s3Client.send(new PutObjectCommand(params));
        const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
        
        picturesData.push({
          image_url: imageUrl,
          name: file,
          category: category,
        });

        console.log(`Successfully uploaded: ${file}`);
        console.log(`URL: ${imageUrl}`);
      } catch (error) {
        console.error(`Failed to upload ${file}:`, error);
      }
    }

    // Insert all pictures into the database
    if (picturesData.length > 0) {
      const result = await client.mutate({
        mutation: INSERT_PICTURE,
        variables: {
          objects: picturesData,
        },
      });
      console.log('Successfully added pictures to database:', result.data.insert_pictures.returning);
    }

  } catch (error) {
    console.error('Error in upload process:', error);
  }
}

// Usage
uploadImagesToS3AndDatabase('./images/videogames'); 