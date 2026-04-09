import { pipeline } from '@huggingface/transformers'
// similarity-test-js.mjs
// Node.js local similarity router test based on your Python baseline.
// Run with: node similarity-test-js.mjs
// Install with: npm i @huggingface/transformers
// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const CONFIG = {
  modelName: 'Xenova/all-MiniLM-L6-v2',
  similarityMetric: 'cosine', // 'cosine' | 'dot' | 'euclidean'
  normalizeEmbeddings: true,
  profileWeight: 0.35,
  exampleWeight: 0.5,
  keywordWeight: 0.15,
  topKExamples: 3,
  quantized: true,
  pooling: 'mean',
}
// -----------------------------------------------------------------------------
// A2A-style data
// -----------------------------------------------------------------------------
const AGENTS = [
  {
    name: 'coding-agent',
    description:
      'Specializes in software development, debugging, backend logic, APIs, algorithms, data structures, refactoring, testing, and general programming help.',
    url: 'http://localhost:8101',
    version: '1.0.0',
    skills: [
      {
        id: 'coding',
        name: 'Code Assistant',
        description:
          'Writes, explains, debugs, refactors, and tests code. Helps with Python, backend systems, APIs, algorithms, classes, functions, linked lists, trees, stacks, queues, and other programming topics.',
        tags: [
          'python', 'code', 'coding', 'debugging', 'refactor', 'backend',
          'api', 'testing', 'async', 'architecture', 'algorithms',
          'data structures', 'linked list', 'tree', 'stack', 'queue',
          'class', 'function', 'recursion', 'leetcode', 'javascript', 'node'
        ],
        examples: [
          'Help me debug a Node.js route that returns a 500 error when the async handler tries to access a missing field.',
          'Refactor this backend service into smaller modules while preserving the helper functions already used elsewhere in the project.',
          'Write a JavaScript function that computes cosine similarity between vectors and explain each part of the implementation.',
          'Explain why this bot app is not responding after deployment and suggest how to trace the issue through the request flow.',
          'Create a local test harness for this API endpoint so I can validate that the payload format and status codes are correct.',
          'Help me merge the functionality of two JS files where one has better formatting and the other has the better runtime logic.',
          'Why am I getting an error saying a variable is undefined in this JavaScript file?',
          'Help me redesign this code so the routing logic, card rendering logic, and network logic are separated cleanly.',
          'Write unit tests for this JavaScript class and include edge cases for invalid input and missing configuration values.',
          'Show me how to implement a linked list in JavaScript and explain each method step by step.'
        ]
      }
    ]
  },
  {
    name: 'research-agent',
    description:
      'Finds information, compares frameworks, summarizes documentation, extracts evidence, and explains technical ideas from sources.',
    url: 'http://localhost:8102',
    version: '1.0.0',
    skills: [
      {
        id: 'research',
        name: 'Research Assistant',
        description:
          'Finds supporting documentation, summarizes sources, compares tools, extracts quotes, and turns technical material into understandable explanations.',
        tags: ['research', 'summary', 'comparison', 'papers', 'documentation', 'evidence', 'quotes', 'architecture', 'sources', 'citations'],
        examples: [
          'Find documentation that supports using A2A for communication between agents and embeddings for routing decisions.',
          'Compare two agent frameworks and explain the major architectural differences in a way I can present in a meeting.',
          'Summarize the latest documentation for agent orchestration and tell me which parts are most relevant for routing.',
          'Give me quotes from official documentation that support the idea of a root orchestrator delegating to specialized agents.',
          'Compare semantic routing using example prompt embeddings against keyword-based routing and explain the tradeoffs.'
        ]
      }
    ]
  },
  {
    name: 'scheduler-agent',
    description:
      'Handles planning, task prioritization, scheduling, timelines, and breaking large goals into structured plans.',
    url: 'http://localhost:8103',
    version: '1.0.0',
    skills: [
      {
        id: 'scheduler',
        name: 'Scheduling Assistant',
        description:
          'Builds plans, calendars, timelines, and prioritized work queues for academic, project, and meeting-oriented tasks.',
        tags: ['schedule', 'calendar', 'planning', 'timeline', 'deadlines', 'prioritization', 'tasks', 'workflow', 'meetings', 'weekly plan'],
        examples: [
          'Help me build a weekly study schedule that balances class work, meetings, job applications, and research tasks.',
          'Organize these deadlines into a timeline so I know what I should work on first each week.',
          'Create a realistic month-long work plan for finishing my project, preparing a presentation, and studying for exams.'
        ]
      }
    ]
  },
  {
    name: 'data-agent',
    description:
      'Specializes in tabular data workflows, pandas operations, dataset cleaning, exploratory analysis, statistical interpretation, and preprocessing for machine learning.',
    url: 'http://localhost:8104',
    version: '1.0.0',
    skills: [
      {
        id: 'data',
        name: 'Data Science Assistant',
        description:
          'Analyzes structured data, validates datasets, writes dataframe-based code, cleans tabular data, and explains statistical results.',
        tags: ['data', 'pandas', 'numpy', 'statistics', 'analysis', 'dataframe', 'cleaning', 'validation', 'eda', 'csv', 'dataset', 'tabular', 'preprocessing'],
        examples: [
          'Help me clean this DataFrame by handling missing values, fixing inconsistent categories, and converting data types.',
          'Analyze the relationship between income and hours worked per week and explain the pattern in plain language.',
          'Create a small exploratory data analysis workflow for this CSV so I can understand distributions and potential issues.'
        ]
      }
    ]
  },
  {
    name: 'presentation-agent',
    description:
      'Turns technical ideas into polished explanations, meeting notes, speaker-ready summaries, and presentation-friendly content.',
    url: 'http://localhost:8105',
    version: '1.0.0',
    skills: [
      {
        id: 'presentation',
        name: 'Presentation Assistant',
        description:
          'Creates speaking notes, simplified summaries, presentation text, and meeting-ready explanations from technical material.',
        tags: ['slides', 'presentation', 'meeting', 'summary', 'speaker-notes', 'communication', 'explanation', 'talking points', 'paragraph'],
        examples: [
          'Turn this technical architecture into a paragraph I can read aloud during a meeting.',
          'Help me explain this system in simpler language for people who are not deeply technical.',
          'Give me a short meeting-ready explanation of how the orchestrator decides which specialized agent should handle a request.'
        ]
      }
    ]
  }
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeText(text) {
  return text.toLowerCase().trim();
}

function l2Norm(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  return Math.sqrt(sum);
}

function normalizeVector(vec) {
  const norm = l2Norm(vec);
  if (norm === 0) return [...vec];
  return vec.map(v => v / norm);
}

function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function cosineSimilarity(a, b) {
  const denom = l2Norm(a) * l2Norm(b);
  if (denom === 0) return 0;
  return dotProduct(a, b) / denom;
}

function euclideanSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return 1 / (1 + Math.sqrt(sum));
}

function similarity(a, b, metric = 'cosine') {
  switch (metric) {
    case 'dot':
      return dotProduct(a, b);
    case 'euclidean':
      return euclideanSimilarity(a, b);
    case 'cosine':
    default:
      return cosineSimilarity(a, b);
  }
}

function weightedTopK(scores) {
  if (scores.length === 0) return 0;
  if (scores.length === 1) return scores[0];

  let weights;
  if (scores.length >= 3) {
    weights = [0.6, 0.3, 0.1];
  } else if (scores.length === 2) {
    weights = [0.7, 0.3];
  } else {
    weights = [1.0];
  }

  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    total += scores[i] * weights[i];
  }
  return total;
}

function buildAgentProfiles(agentCards) {
  return agentCards.map(card => {
    const skillNames = [];
    const skillDescriptions = [];
    const tags = [];

    for (const skill of card.skills) {
      skillNames.push(skill.name);
      skillDescriptions.push(skill.description);
      tags.push(...skill.tags);
    }

    return {
      agentName: card.name,
      agentUrl: card.url,
      profileText: `Agent name: ${card.name}. Agent description: ${card.description}. Skills: ${skillNames.join('; ')}. Skill descriptions: ${skillDescriptions.join('; ')}. Tags: ${tags.join(', ')}.`
    };
  });
}

function buildAgentExamples(agentCards) {
  const result = {};
  for (const card of agentCards) {
    result[card.name] = card.skills.flatMap(skill => skill.examples);
  }
  return result;
}

function buildKeywordRules() {
  return {
    'coding-agent': {
      positive: ['code', 'coding', 'program', 'programming', 'python', 'javascript', 'node', 'api', 'backend', 'frontend', 'debug', 'bug', 'refactor', 'algorithm', 'linked list', 'tree', 'graph', 'queue', 'stack', 'function', 'class', 'implementation', 'implement'],
      negative: ['dataframe', 'pandas', 'csv', 'dataset', 'statistics', 'presentation', 'slides', 'speaker notes', 'timeline', 'calendar', 'schedule']
    },
    'data-agent': {
      positive: ['dataframe', 'pandas', 'numpy', 'csv', 'dataset', 'data analysis', 'statistics', 'correlation', 'regression', 'missing values', 'outlier', 'visualization', 'eda', 'preprocessing', 'tabular', 'merge', 'null values'],
      negative: ['linked list', 'tree', 'graph algorithm', 'pointer', 'recursion', 'stack', 'queue', 'leetcode', 'binary tree', 'data structure']
    },
    'research-agent': {
      positive: ['research', 'paper', 'papers', 'documentation', 'docs', 'sources', 'citation', 'citations', 'compare frameworks', 'evidence', 'quote', 'quotes', 'official documentation'],
      negative: []
    },
    'scheduler-agent': {
      positive: ['schedule', 'timeline', 'deadline', 'deadlines', 'calendar', 'plan', 'prioritize', 'prioritization', 'meeting', 'weekly plan', 'monthly plan', 'work plan', 'organize tasks'],
      negative: []
    },
    'presentation-agent': {
      positive: ['presentation', 'meeting', 'speaker notes', 'slides', 'paragraph to read', 'explain simply', 'talking points', 'present this', 'read aloud', 'lower level of understanding'],
      negative: []
    }
  };
}

function keywordScore(agentName, prompt, keywordRules) {
  const rules = keywordRules[agentName] ?? { positive: [], negative: [] };
  const text = normalizeText(prompt);

  let score = 0;
  for (const phrase of rules.positive) {
    if (text.includes(phrase)) score += 0.08;
  }
  for (const phrase of rules.negative) {
    if (text.includes(phrase)) score -= 0.06;
  }
  return score;
}

async function extractEmbeddings(extractor, texts, { pooling, normalizeEmbeddings, quantized }) {
  const output = await extractor(texts, {
    pooling,
    normalize: false,
    quantized,
  });

  const rows = output.tolist();
  return rows.map(row => (normalizeEmbeddings ? normalizeVector(row) : row));
}

class SimilarityRouter {
  constructor(agentCards, config = {}) {
    this.agentCards = agentCards;
    this.config = { ...CONFIG, ...config };
    this.agentProfiles = buildAgentProfiles(agentCards);
    this.agentExamples = buildAgentExamples(agentCards);
    this.keywordRules = buildKeywordRules();
    this.extractor = null;
    this.profileEmbeddings = [];
    this.exampleEmbeddings = {};
  }

  async init() {
    this.extractor = await pipeline('feature-extraction', this.config.modelName);

    this.profileEmbeddings = await extractEmbeddings(
      this.extractor,
      this.agentProfiles.map(x => x.profileText),
      this.config
    );

    for (const [agentName, examples] of Object.entries(this.agentExamples)) {
      this.exampleEmbeddings[agentName] = await extractEmbeddings(
        this.extractor,
        examples,
        this.config
      );
    }
  }

  scoreProfile(promptEmbedding, agentIdx) {
    return similarity(promptEmbedding, this.profileEmbeddings[agentIdx], this.config.similarityMetric);
  }

  scoreExamples(agentName, promptEmbedding) {
    const examples = this.agentExamples[agentName];
    const embeddings = this.exampleEmbeddings[agentName];

    const scored = embeddings.map((embedding, idx) => ({
      text: examples[idx],
      score: similarity(promptEmbedding, embedding, this.config.similarityMetric),
    }));

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, this.config.topKExamples);

    return {
      score: weightedTopK(top.map(x => x.score)),
      matchedExamples: top,
    };
  }

  async route(userPrompt) {
    const [promptEmbedding] = await extractEmbeddings(this.extractor, [userPrompt], this.config);

    const results = this.agentProfiles.map((agent, idx) => {
      const profileScore = this.scoreProfile(promptEmbedding, idx);
      const exampleResult = this.scoreExamples(agent.agentName, promptEmbedding);
      const keyword = keywordScore(agent.agentName, userPrompt, this.keywordRules);

      const finalScore =
        this.config.profileWeight * profileScore +
        this.config.exampleWeight * exampleResult.score +
        this.config.keywordWeight * keyword;

      return {
        agentName: agent.agentName,
        agentUrl: agent.agentUrl,
        profileScore,
        exampleScore: exampleResult.score,
        keywordScore: keyword,
        finalScore,
        matchedExamples: exampleResult.matchedExamples,
      };
    });

    results.sort((a, b) => b.finalScore - a.finalScore);
    return results;
  }
}

function printConfig(config) {
  console.log('='.repeat(90));
  console.log('Local JS Similarity Router Test');
  console.log('='.repeat(90));
  console.log(`Model:                 ${config.modelName}`);
  console.log(`Similarity metric:     ${config.similarityMetric}`);
  console.log(`Normalize embeddings:  ${config.normalizeEmbeddings}`);
  console.log(`Weights:               profile=${config.profileWeight}, examples=${config.exampleWeight}, keyword=${config.keywordWeight}`);
  console.log(`Top-k examples:        ${config.topKExamples}`);
  console.log(`Pooling:               ${config.pooling}`);
  console.log(`Quantized:             ${config.quantized}`);
}

function printResults(prompt, results) {
  const best = results[0];
  console.log('\n' + '-'.repeat(90));
  console.log(`Prompt: ${prompt}`);
  console.log('-'.repeat(90));
  console.log(`Best Match      : ${best.agentName}`);
  console.log(`URL             : ${best.agentUrl}`);
  console.log(`Final score     : ${best.finalScore.toFixed(4)}`);
  console.log(`Profile score   : ${best.profileScore.toFixed(4)}`);
  console.log(`Example score   : ${best.exampleScore.toFixed(4)}`);
  console.log(`Keyword score   : ${best.keywordScore.toFixed(4)}`);

  console.log('\nTop matched examples for winning agent:');
  for (const item of best.matchedExamples) {
    console.log(`  ${item.score.toFixed(4)} | ${item.text}`);
  }

  console.log('\nFull ranking:');
  results.forEach((r, idx) => {
    console.log(
      `${idx + 1}. ${r.agentName.padEnd(22)} final=${r.finalScore.toFixed(4)} | profile=${r.profileScore.toFixed(4)} | examples=${r.exampleScore.toFixed(4)} | keyword=${r.keywordScore.toFixed(4)}`
    );
  });

  if (results.length > 1) {
    console.log(`\nTop-2 margin: ${(results[0].finalScore - results[1].finalScore).toFixed(4)}`);
  }
}

async function main() {
  const router = new SimilarityRouter(AGENTS, CONFIG);
  printConfig(router.config);
  console.log('\nLoading model and precomputing embeddings...');
  await router.init();

  const testPrompts = [
    'Help me build a JavaScript test harness to compare embedding similarity formulas for agent routing.',
    'Find documentation that explains whether example prompt embeddings are better than keyword-only routing.',
    'Create a study schedule for this week that balances coding, research, and meetings.',
    'Turn this agent orchestration design into a short paragraph I can read in a meeting.',
    'Help me clean a CSV and explain the relationship between hours worked and income.',
    'Write a Python function merges two lists together in order while removing duplicates and explain how it works.',
    'Why am I getting an error in this Node.js route and how can I debug it?'
  ];

  for (const prompt of testPrompts) {
    const results = await router.route(prompt);
    printResults(prompt, results);
  }
}

main().catch(err => {
  console.error('\nFatal error while running similarity test:');
  console.error(err);
  process.exit(1);
});
