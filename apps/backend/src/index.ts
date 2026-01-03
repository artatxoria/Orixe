import Fastify from 'fastify';
import cors from '@fastify/cors';
import OpenAI from 'openai';
import axios from 'axios';

const server = Fastify({ logger: true });

// Clientes de IA
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1'
});

const cerebras = new OpenAI({
    apiKey: process.env.CEREBRAS_API_KEY,
    baseURL: 'https://api.cerebras.ai/v1'
});

const ollama = new OpenAI({
    apiKey: 'ollama', // No necesaria para local
    baseURL: 'http://host.docker.internal:11434/v1'
});

server.register(cors);

server.get('/health', async () => {
    return { status: 'ok', service: 'orixe-backend' };
});

// Endpoint de Chat con Fallback
server.post('/chat', async (request, reply) => {
    const { prompt } = request.body as { prompt: string };

    // 1. Intentar Cerebras
    try {
        const response = await cerebras.chat.completions.create({
            model: 'llama3.1-8b',
            messages: [{ role: 'user', content: prompt }]
        });
        return { source: 'cerebras', text: response.choices[0].message.content };
    } catch (e) {
        server.log.error('Cerebras falló, intentando Groq...');
    }

    // 2. Intentar Groq
    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [{ role: 'user', content: prompt }]
        });
        return { source: 'groq', text: response.choices[0].message.content };
    } catch (e) {
        server.log.error('Groq falló, intentando Ollama...');
    }
    // 3. INTENTAR HUGGING FACE
    try {
        server.log.info('Intentando Hugging Face...');
        const hfResponse = await axios.post(
            'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3',
            { inputs: prompt },
            { 
                headers: { 
                    'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                    'Content-Type': 'application/json'
                } 
            }
        );
        
        // La respuesta de HF suele ser un array: [{ generated_text: "..." }]
        const result = hfResponse.data;
        const text = Array.isArray(result) ? result[0].generated_text : result.generated_text;
        
        return { source: 'huggingface', text: text };
    } catch (e: any) { 
        server.log.error(`Hugging Face falló: ${e.message}`); 
    }
    // 4. Última instancia: Ollama Local
    try {
        const response = await ollama.chat.completions.create({
            model: 'mistral:7b-instruct', // Asegúrate de que este nombre coincida con 'ollama list'
            messages: [{ role: 'user', content: prompt }]
        });
        return { source: 'ollama', text: response.choices[0].message.content };
    } catch (e) {
        return reply.status(500).send({ error: 'Todos los modelos fallaron' });
    }
});

const start = async () => {
    try {
        await server.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};
start();