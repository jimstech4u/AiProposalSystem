import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Check, Code, Database, Server, Cloud, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithGemini } from '../../../lib/gemini';
import { readJson, saveJson } from '../../../lib/storage';
import { insertRow } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';

export default function TechnologyRecommendation() {
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const projectId = readJson<string | null>('latestProjectId', null);
  const session = getStoredSession();
  const [generating, setGenerating] = useState(false);
  const [recommendedStack, setRecommendedStack] = useState(readJson<any>('latestTechStack', null));

  const [alternatives, setAlternatives] = useState(readJson<any[]>('latestTechAlternatives', []));

  const regenerate = async () => {
    setGenerating(true);
    try {
      const prompt = `Recommend a technology stack for this software project. Return only JSON: {recommendedStack:{frontend:{name,version,confidence},backend:{name,version,confidence},database:{name,version,confidence},cloud:{name,version,confidence},rationale:string}, alternatives:[{name,match,pros,cons}]}.
Analysis: ${JSON.stringify(latestAnalysis)}`;
      const generated = extractJsonObject(await generateWithGemini(prompt), { recommendedStack: null, alternatives: [] });
      setRecommendedStack(generated.recommendedStack);
      setAlternatives(generated.alternatives);
      saveJson('latestTechStack', generated.recommendedStack);
      saveJson('latestTechAlternatives', generated.alternatives);
      if (projectId && generated.recommendedStack) {
        const scores = [
          generated.recommendedStack.frontend?.confidence,
          generated.recommendedStack.backend?.confidence,
          generated.recommendedStack.database?.confidence,
          generated.recommendedStack.cloud?.confidence,
        ].filter((value: unknown): value is number => typeof value === 'number');
        await insertRow('tech_recommendations', {
          project_id: projectId,
          created_by: session?.userId ?? null,
          stack_name: [
            generated.recommendedStack.frontend?.name,
            generated.recommendedStack.backend?.name,
            generated.recommendedStack.database?.name,
          ].filter(Boolean).join(' / ') || 'Recommended Stack',
          frontend: generated.recommendedStack.frontend?.name ?? null,
          backend: generated.recommendedStack.backend?.name ?? null,
          database_name: generated.recommendedStack.database?.name ?? null,
          hosting: generated.recommendedStack.cloud?.name ?? null,
          match_score: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
          rationale: generated.recommendedStack.rationale ?? null,
          pros: generated.alternatives?.flatMap((alternative: any) => alternative.pros ?? []) ?? [],
          cons: generated.alternatives?.flatMap((alternative: any) => alternative.cons ?? []) ?? [],
          alternatives: generated.alternatives ?? [],
        });
      }
      toast.success('Technology recommendation generated with Gemini.');
    } catch (error) {
      toast.warning('Gemini technology recommendation failed; current stack retained.');
      console.warn(error);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Technology Stack Recommendation</h1>
          <p className="text-gray-600 mt-1">AI-powered technology selection</p>
        </div>
        <Button variant="ai" onClick={regenerate} disabled={generating}>
          <Sparkles className="w-4 h-4 mr-1" />
          {generating ? 'Generating...' : 'Regenerate'}
        </Button>
      </div>

      {/* Recommended Stack */}
      <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Recommended Technology Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recommendedStack ? (
            <p className="text-sm text-gray-600">No technology recommendation has been generated yet. Use the regenerate action after completing requirement analysis.</p>
          ) : (
          <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Code className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Frontend</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.frontend?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.frontend?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.frontend?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Server className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Backend</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.backend?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.backend?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.backend?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Database</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.database?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.database?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.database?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <Cloud className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Cloud</h3>
              <p className="text-2xl font-bold text-gray-900">{recommendedStack.cloud?.name ?? 'Not set'}</p>
              <p className="text-sm text-gray-600 mt-1">{recommendedStack.cloud?.version ?? ''}</p>
              <div className="mt-4">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  {recommendedStack.cloud?.confidence ?? 0}% Match
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Why We Recommend This Stack</h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              {recommendedStack.rationale ?? 'No rationale generated.'}
            </p>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      {/* Alternative Stacks */}
      <Card>
        <CardHeader>
          <CardTitle>Alternative Technology Stacks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alternatives.map((stack, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{stack.name}</h4>
                    <Badge variant="info" className="mt-1">{stack.match}% Match</Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-700 mb-1">Pros:</p>
                    <ul className="space-y-0.5">
                      {stack.pros.map((pro, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-700"><Check className="h-4 w-4 text-green-700" /> {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-red-700 mb-1">Cons:</p>
                    <ul className="space-y-0.5">
                      {stack.cons.map((con, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-gray-700"><X className="h-4 w-4 text-red-700" /> {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
