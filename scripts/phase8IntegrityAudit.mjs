import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
function check(name, ok, detail='') { checks.push({name,ok,detail}); }

const server=read('server.ts');
const memory=read('src/server/supabaseMemorySync.ts');
const schema=read('supabase/migrations/20260930_production_memory.sql');
const rag=read('supabase/migrations/20260930_rag_pgvector_runtime.sql');
const clientMemory=read('src/services/learningMemoryService.ts');

check('Tutor chat authentication middleware', server.includes("app.use('/api/tutor/chat', requireAuth)"));
check('Student routes authentication + ownership middleware', server.includes("app.use('/api/student/:id', requireAuth, requireStudentAccess)"));
check('Stable client attempt id is required in durable mode', server.includes("CLIENT_ATTEMPT_ID_REQUIRED"));
check('Atomic learning RPC exists', schema.includes('record_learning_attempt_atomic(payload jsonb)'));
check('Atomic RPC is not executable by authenticated/anonymous roles', schema.includes('revoke execute on function public.record_learning_attempt_atomic(jsonb) from public, anon, authenticated;'));
check('Atomic RPC is executable by service role', schema.includes('grant execute on function public.record_learning_attempt_atomic(jsonb) to service_role;'));
check('Attempt idempotency unique index', schema.includes('uq_learning_attempts_client_attempt'));
check('One active tutor question per student', schema.includes('uq_active_tutor_question_per_student'));
check('RAG vector type is 3072 dimensions', schema.includes('embedding vector(3072)'));
check('RAG retrieval filters inactive documents', rag.includes('where d.active = true'));
check('RAG RPC is service-role only', rag.includes('grant execute on function public.match_knowledge_chunks(vector, integer, uuid, uuid, text) to service_role;'));
check('Plan hydrates durable state before generation', server.includes("app.get('/api/student/:id/plan', async") && server.includes('await supabaseMemorySync.hydrateStudent(id);'));
check('Parent report hydrates durable state', server.includes("app.get('/api/student/:id/parent-report', async") && server.includes('await supabaseMemorySync.hydrateStudent(id);'));
check('Parent settings syncs durable profile', server.includes('await supabaseMemorySync.syncProfile(id, updatedProfile);'));
check('Client generates stable attempt id', /const clientAttemptId = `\$\{studentId\}_\$\{chapterId\}_/.test(clientMemory));
check('No hard-coded Fish Tale daily plan', !read('src/server/studentLearningMemory.ts').includes('NCERT Chapter 1: The Fish Tale'));
check('No client-side Gemini key reference', !fs.readFileSync(path.join(root,'src/clientApi.ts'),'utf8').includes('GEMINI_API_KEY'));

const failed=checks.filter(x=>!x.ok);
for (const c of checks) console.log(`${c.ok?'PASS':'FAIL'} | ${c.name}${c.detail?` | ${c.detail}`:''}`);
console.log(`\nTOTAL ${checks.length} | PASS ${checks.length-failed.length} | FAIL ${failed.length}`);
process.exitCode=failed.length?1:0;
