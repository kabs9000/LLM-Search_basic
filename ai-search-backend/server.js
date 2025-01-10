const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;
const { Groq } = require('groq');
const { SentenceTransformer } = require('sentence-transformers');
const model = new SentenceTransformer('all-MiniLM-L6-v2');

require('dotenv').config();

app.use(express.json());
app.use(cors({
  origin: 'http://localhost:8080', // Ensure this matches your frontend URL
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.post('/search', async (req, res) => {
  const query = req.body.query;

  try {
    console.log('Sending search request to DuckDuckGo for query:', query);

    // SEARCH USING DUCKDUCKGO API
    const duckDuckGoResponse = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`);

    console.log('DuckDuckGo Response:', duckDuckGoResponse.data);

    // Process both RelatedTopics and Results
    const relatedTopics = duckDuckGoResponse.data.RelatedTopics || [];
    const results = duckDuckGoResponse.data.Results || [];

    const combinedResults = [
      ...relatedTopics.map(topic => ({
        title: topic.Text || 'No Title',
        abstract: topic.FirstURL || 'No Abstract',
        link: topic.FirstURL || '#'
      })),
      ...results.map(result => ({
        title: result.Text || 'No Title',
        abstract: result.FirstURL || 'No Abstract',
        link: result.FirstURL || '#'
      }))
    ];

    // Generate embeddings for query and results
    const queryEmbedding = await model.encode(query);
    const resultEmbeddings = await Promise.all(combinedResults.map(result => model.encode(result.title + ' ' + result.abstract)));

    // Calculate cosine similarity
    const similarities = resultEmbeddings.map(embedding => cosineSimilarity(queryEmbedding, embedding));

    // Sort results by similarity
    const rankedResults = combinedResults
      .map((result, index) => ({ ...result, similarity: similarities[index] }))
      .sort((a, b) => b.similarity - a.similarity);

    // Limit to top 100 results for better coverage
    const limitedResults = rankedResults.slice(0, 100);

    console.log('Processed and Ranked DuckDuckGo Results:', limitedResults);

    // CHANGE HERE: Update the GROQ client initialization to use the Llama 3.1 70B model
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.1-70b-versatile'  // Updated to use Llama 3.1 70B
    });

    // CHANGE HERE: Update the summarization prompt to leverage the new model's capabilities
    const summarizationPrompt = `
      You are an advanced AI assistant powered by the Llama 3.1 70B model. Your task is to provide a comprehensive and insightful summary of the following search results for the query: "${query}"

      Here are the top search results, ranked by semantic similarity:
      ${JSON.stringify(limitedResults, null, 2)}

      Please provide:
      1. A concise yet informative summary of the main points related to the query.
      2. Any relevant facts, figures, or statistics that stand out.
      3. A brief analysis of different perspectives or viewpoints, if applicable.
      4. Suggestions for further exploration or related topics the user might find interesting.

      Aim for a response that is both informative and engaging, showcasing the advanced capabilities of the Llama 3.1 70B model.
    `;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: summarizationPrompt }],
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const summary = completion.choices[0].message.content;

    res.json({ summary });
  } catch (error) {
    console.error('Error details:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to fetch search results', details: error.message });
  }
});

// Helper function to calculate cosine similarity
function cosineSimilarity(a, b) {
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'Set' : 'Not set'); // This can be removed if not using GROQ API
});