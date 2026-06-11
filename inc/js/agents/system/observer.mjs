//import { pipeline } from '@huggingface/transformers'

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
// Instead of embedding full agent cards locally, fetch agent metadata from configured endpoints.
async function fetchAgentCards() {
  // Placeholder for actual fetching logic. 
  // In production, this would call the agent endpoints and retrieve their metadata.
  
}

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
    //this.keywordRules = buildKeywordRules();
    this.extractor = null;
    this.profileEmbeddings = [];
    this.exampleEmbeddings = {};
  }

  //Commented out to avoid loading model when testing other parts of the system. 
  // Re-enable when ready to test similarity routing locally.

  /*async init() {
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
*/

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




  //original test main: 

  /*
  console.log('\nResolving agent endpoints and fetching agent metadata...');
  const agentCards = await fetchAgentCards(CONFIG.agentEndpoints || []);
  const router = new SimilarityRouter(agentCards, CONFIG);
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

  */
}

// -----------------------------------------------------------------------------
// OBSERVER
// -----------------------------------------------------------------------------

function deconstructA2ACard(a2aCard = null) {
  if (!a2aCard || typeof a2aCard !== 'object') {
    return null
  }

  const skills = Array.isArray(a2aCard.skills)
    ? a2aCard.skills
    : []

  const normalizedSkills = skills.map(skill => {
    const tags = Array.isArray(skill.tags)
      ? skill.tags
      : []

    const examples = Array.isArray(skill.examples)
      ? skill.examples
      : []

    const skillText = [
      skill.id ? `Skill id: ${skill.id}` : '',
      skill.name ? `Skill name: ${skill.name}` : '',
      skill.description ? `Skill description: ${skill.description}` : '',
      tags.length ? `Tags: ${tags.join(', ')}` : '',
      examples.length ? `Examples: ${examples.join(' ')}` : '',
    ]
      .filter(Boolean)
      .join('. ')

    return {
      id: skill.id ?? null,
      name: skill.name ?? null,
      description: skill.description ?? null,
      tags,
      examples,
      skillText,
    }
  })

  const exampleTexts = normalizedSkills.flatMap(skill => skill.examples)
  const keywordTexts = normalizedSkills.flatMap(skill => skill.tags)

  const profileText = [
    a2aCard.id ? `Agent id: ${a2aCard.id}` : '',
    a2aCard.name ? `Agent name: ${a2aCard.name}` : '',
    a2aCard.description ? `Agent description: ${a2aCard.description}` : '',
    a2aCard.provider?.organization ? `Provider organization: ${a2aCard.provider.organization}` : '',
    a2aCard.defaultInputModes?.length ? `Input modes: ${a2aCard.defaultInputModes.join(', ')}` : '',
    a2aCard.defaultOutputModes?.length ? `Output modes: ${a2aCard.defaultOutputModes.join(', ')}` : '',
    normalizedSkills.length ? `Skills: ${normalizedSkills.map(skill => skill.name).filter(Boolean).join(', ')}` : '',
    normalizedSkills.length ? `Skill descriptions: ${normalizedSkills.map(skill => skill.description).filter(Boolean).join(' ')}` : '',
    keywordTexts.length ? `Tags: ${keywordTexts.join(', ')}` : '',
    exampleTexts.length ? `Examples: ${exampleTexts.join(' ')}` : '',
  ]
    .filter(Boolean)
    .join('. ')

  return {
    id: a2aCard.id ?? null,
    name: a2aCard.name ?? null,
    description: a2aCard.description ?? null,
    url: a2aCard.url ?? null,
    version: a2aCard.version ?? null,
    cardType: a2aCard.cardType ?? null,
    profileText,
    skills: normalizedSkills,
    exampleTexts,
    keywordTexts,
  }
}

class ObserverAgent {
  async observe(param = {}, factory, llm) {
    
    console.log('\n================ RAW PARAM =================')
    console.dir(param, { depth: null })
    console.log('============================================\n')

    const prompt =
      param?.message ??
      param?.prompt ??
      param?.conversation?.prompt ??
      null

    const originalPrompt =
      param?.originalMessage ??
      param?.conversation?.originalPrompt ??
      null

    const a2aCard =
      param?.agentCard ??
      param?.bot?.agentCard ??
      null

    const parsedA2ACard = deconstructA2ACard(a2aCard)

    const observerPayload = {
      request: {
        prompt,
        originalPrompt,
        timestamp: new Date().toISOString(),
      },
      bot: {
        id: param?.bot?.id ?? null,
        name: param?.bot?.name ?? null,
        type: param?.bot?.type ?? null,
        agentCard: a2aCard,
        parsedA2ACard,
      },
      conversation: {
        id: param?.conversation?.id ?? null,
        threadId: param?.conversation?.thread_id ?? null,
      },
      avatar: {
        id: param?.avatar?.id ?? null,
        name: param?.avatar?.name ?? null,
      },
    }

  console.log('\n================ OBSERVER ================')

  console.log('[Observer] Prompt:', prompt)
  console.log('[Observer] Original Prompt:', originalPrompt)

  console.log('[Observer] Card Present:', !!a2aCard)

  console.log(
    '[Observer] Skill Count:',
    parsedA2ACard?.skills?.length ?? 0
  )

  console.log(
    '[Observer] Example Count:',
    parsedA2ACard?.exampleTexts?.length ?? 0
  )

  console.log(
    '[Observer] Keyword Count:',
    parsedA2ACard?.keywordTexts?.length ?? 0
  )

  console.log('[Observer] Parsed A2A Card:')
  console.dir(parsedA2ACard, { depth: null })

  console.log('==========================================\n')


    return {
      success: true,
      observed: true,
      prompt,
      originalPrompt,
      a2aCard,
      parsedA2ACard,
      payload: observerPayload,
    }
  }
}

// simple helper export
async function observePrompt(payload = {}) {
  const observer = new ObserverAgent()
  return observer.observe(payload)
}

export {
  ObserverAgent,
  observePrompt,
  deconstructA2ACard,
}