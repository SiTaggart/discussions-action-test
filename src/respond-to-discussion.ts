#!/usr/bin/env node
import minimist from 'minimist';
import { Octokit } from '@octokit/core';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { StreamingTextResponse } from 'ai';

dotenv.config();

type Discussion = {
  path: string;
  content: string;
  similarity: number;
  source: string;
  type: string;
  meta: Record<string, unknown>;
  heading: string;
  slug: string;
};
type DiscussionsResponse = {
  data: Discussion[];
};

const commentHeader = `
  This is a very experimental bot that uses OpenAI's GPT-4 to respond to discussions. The answers are not guaranteed to be correct.

  We hope it provides a quicker way to get or find answers to your questions. Please wait for a member of the Design System team to confirm the answer.

  ---
`;

async function getGPTResponse(prompt: string): Promise<string> {
  const res = await fetch('https://paste.twilio.design/api/ai', {
    method: 'POST',
    body: JSON.stringify({
      secret: process.env.OPENAI_API_SECRET,
      prompt,
    }),
  });

  const stream = res.body as unknown as StreamingTextResponse;
  const chunks = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    stream.on('end', () => {
      const data = Buffer.concat(chunks).toString('utf8');
      resolve(data);
    });

    stream.on('error', (err) => {
      reject(err);
    });
  });
}

const respondToDiscussion = async () => {
  const argv = minimist(process.argv.slice(2));

  const { discussionBody, discussionTitle, discussionAuthor, discussionID } =
    argv;

  console.log(discussionBody, discussionTitle, discussionAuthor, discussionID);

  const octokit = new Octokit({
    auth: process.env.GH_SERVICE_ACC_DISCUSSIONS_TOKEN,
  });

  const relatedDiscussionsResponse = await fetch(
    'https://paste.twilio.design/api/discussions-search',
    {
      method: 'POST',
      body: JSON.stringify({
        secret: process.env.OPENAI_API_SECRET,
        prompt: discussionBody,
      }),
    }
  );
  const relatedDiscussionsData =
    (await relatedDiscussionsResponse.json()) as unknown as DiscussionsResponse;

  // filter the discussions to remove any discussion that is already represented in the list because it shares a path value
  const filteredDiscussions: Discussion[] = relatedDiscussionsData.data.filter(
    (discussion, index, self) =>
      index === self.findIndex((t) => t.path === discussion.path)
  );

  const topThreeDiscussions = filteredDiscussions.slice(0, 3);

  const discussionList = topThreeDiscussions
    .map((discussion) => {
      return `- [${discussion.heading}](${discussion.path})`;
    })
    .join('\n');

  const relatedDiscussionsMessage = `Here are some related discussions that might help:\n\n${discussionList}`;

  const PasteGPTResponse = await getGPTResponse(discussionBody);

  const discussionResponse = `${commentHeader}\n\n${PasteGPTResponse}\n\n${relatedDiscussionsMessage}`;

  console.log(discussionResponse);

  // octokit.graphql(`
  //   mutation discussion($discussionid:ID!,$body:String!) {
  //     addDiscussionComment(input: { discussionId:${discussionID},body:${discussionResponse}}) {
  //       comment {
  //         id
  //       }
  //     }
  //   }`);
};

async function main(): Promise<void> {
  await respondToDiscussion();
}

main().catch((error) => {
  console.error(error);

  // Exit with non-zero code
  process.exit(1);
});
