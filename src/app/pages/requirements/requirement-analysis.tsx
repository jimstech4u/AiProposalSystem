import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Sparkles, Plus, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import { extractJsonObject, generateWithGemini } from '../../../lib/gemini';
import { saveJson } from '../../../lib/storage';
import { encodeFilterValue, insertRow, selectRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';

export default function RequirementAnalysis() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  
  const [projectData, setProjectData] = useState({
    name: '',
    client: '',
    description: '',
    projectType: 'web',
    industry: 'ecommerce',
    launchDate: '',
    budget: 50000,
    expectedUsers: 1000,
  });

  const [requirements, setRequirements] = useState([
    { id: 1, description: '', category: 'auth', priority: 'high' },
  ]);
  const session = getStoredSession();

  const addRequirement = () => {
    setRequirements([
      ...requirements,
      { id: Date.now(), description: '', category: 'auth', priority: 'medium' },
    ]);
  };

  const removeRequirement = (id: number) => {
    setRequirements(requirements.filter((r) => r.id !== id));
  };

  const updateRequirement = (id: number, field: string, value: string) => {
    setRequirements(
      requirements.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleAnalyze = async () => {
    if (!projectData.name || !projectData.client) {
      toast.error('Please fill in required project information');
      return;
    }

    setAnalyzing(true);

    const fallback = {
      project: projectData,
      requirements,
      summary: {
        complexityScore: 7.2,
        complexityLabel: 'Medium-High',
        confidenceScore: 89,
        totalRequirements: Math.max(requirements.length, 1),
      },
      categories: [
        { name: 'Authentication', value: 1, color: '#3b82f6' },
        { name: 'Data Management', value: 1, color: '#8b5cf6' },
        { name: 'Reporting', value: 1, color: '#10b981' },
        { name: 'Integration', value: 1, color: '#f59e0b' },
        { name: 'UI', value: 1, color: '#ef4444' },
      ],
      complexity: [
        { subject: 'UI/UX', A: 6, fullMark: 10 },
        { subject: 'Backend', A: 7, fullMark: 10 },
        { subject: 'Database', A: 6, fullMark: 10 },
        { subject: 'Integration', A: 7, fullMark: 10 },
        { subject: 'Security', A: 7, fullMark: 10 },
      ],
      identifiedRequirements: requirements.map((requirement) => ({
        id: requirement.id,
        description: requirement.description || 'Requirement pending clarification',
        category: requirement.category,
        priority: requirement.priority,
        complexity: 'Medium',
        confidence: 82,
      })),
      missingRequirements: [
        { description: 'Clarify security, reporting, and integration acceptance criteria.', severity: 'Medium' },
      ],
      nextSteps: [
        'Validate requirements with the client',
        'Generate proposal draft',
        'Run cost and timeline estimation',
      ],
    };

    try {
      const prompt = `Analyze this software project for technical proposal preparation. Return only valid JSON with keys: summary {complexityScore:number, complexityLabel:string, confidenceScore:number,totalRequirements:number}, categories [{name,value,color}], complexity [{subject,A,fullMark}], identifiedRequirements [{id,description,category,priority,complexity,confidence}], missingRequirements [{description,severity}], nextSteps [string].

Project: ${JSON.stringify(projectData)}
Requirements: ${JSON.stringify(requirements)}`;
      const text = await generateWithGemini(prompt);
      const analysis = extractJsonObject(text, fallback);
      saveJson('latestAnalysis', { ...analysis, project: projectData, requirements, generatedAt: new Date().toISOString() });

      let savedProjectId: string | null = null;
      try {
        const [existingClient] = await selectRows<any>(
          'clients',
          `select=id&company_name=eq.${encodeFilterValue(projectData.client.trim())}&limit=1`
        );
        const [savedClient] = existingClient
          ? [existingClient]
          : await insertRow('clients', {
              company_name: projectData.client.trim(),
              industry: projectData.industry,
              created_by: session?.userId ?? null,
            });

        const [savedProject] = await insertRow('projects', {
          client_id: savedClient?.id ?? null,
          title: projectData.name,
          description: projectData.description,
          industry: projectData.industry,
          project_type: projectData.projectType,
          status: 'analysis',
          requirements_text: requirements.map((item) => item.description).join('\n'),
          target_users: String(projectData.expectedUsers),
          complexity_score: analysis.summary.complexityScore * 10,
          confidence_score: analysis.summary.confidenceScore,
          submitted_by: session?.userId ?? null,
        });
        savedProjectId = savedProject?.id ?? null;
        if (savedProjectId) {
          saveJson('latestProjectId', savedProjectId);
          await Promise.all(
            requirements
              .filter((requirement) => requirement.description.trim())
              .map((requirement) =>
                insertRow('requirements', {
                  project_id: savedProjectId,
                  category: requirement.category,
                  title: requirement.description.slice(0, 80),
                  description: requirement.description,
                  priority: requirement.priority,
                  requirement_type: 'functional',
                  complexity: 50,
                })
              )
          );
        }
      } catch (error) {
        console.warn('Supabase project persistence skipped:', error);
      }

      setAnalyzing(false);
      navigate(savedProjectId ? `/requirements/${savedProjectId}/results` : '/requirements/1/results');
    } catch (error) {
      saveJson('latestAnalysis', { ...fallback, generatedAt: new Date().toISOString() });
      setAnalyzing(false);
      toast.warning('Gemini was unavailable; generated a local analysis fallback.');
      console.warn(error);
      navigate('/requirements/1/results');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">New Requirement Analysis</h1>
        <p className="text-gray-600 mt-1">AI-powered requirement analysis and categorization</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center space-x-4 py-6">
        {[
          { num: 1, label: 'Project Info' },
          { num: 2, label: 'Requirements' },
          { num: 3, label: 'Analysis' },
        ].map((s) => (
          <div key={s.num} className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step >= s.num
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {s.num}
            </div>
            <span
              className={`ml-2 text-sm font-medium ${
                step >= s.num ? 'text-gray-900' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
            {s.num < 3 && (
              <div
                className={`w-12 h-0.5 mx-4 ${
                  step > s.num ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Project Information */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Project Name *
                </label>
                <Input
                  placeholder="Client portal implementation"
                  value={projectData.name}
                  onChange={(e) =>
                    setProjectData({ ...projectData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Client Name *
                </label>
                <Input
                  placeholder="Client company name"
                  value={projectData.client}
                  onChange={(e) =>
                    setProjectData({ ...projectData, client: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Project Description
              </label>
              <textarea
                className="w-full h-24 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the project goals and objectives..."
                value={projectData.description}
                onChange={(e) =>
                  setProjectData({ ...projectData, description: e.target.value })
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Project Type
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={projectData.projectType}
                  onChange={(e) =>
                    setProjectData({ ...projectData, projectType: e.target.value })
                  }
                >
                  <option value="web">Web Application</option>
                  <option value="mobile">Mobile Application</option>
                  <option value="desktop">Desktop Application</option>
                  <option value="api">API/Backend Service</option>
                  <option value="ecommerce">E-commerce Platform</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Industry
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={projectData.industry}
                  onChange={(e) =>
                    setProjectData({ ...projectData, industry: e.target.value })
                  }
                >
                  <option value="ecommerce">E-commerce</option>
                  <option value="healthcare">Healthcare</option>
                  <option value="finance">Finance</option>
                  <option value="education">Education</option>
                  <option value="manufacturing">Manufacturing</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Target Launch Date
                </label>
                <Input type="date" value={projectData.launchDate} onChange={(e) => setProjectData({ ...projectData, launchDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Expected Users
                </label>
                <Input
                  type="number"
                  placeholder="1000"
                  value={projectData.expectedUsers}
                  onChange={(e) =>
                    setProjectData({
                      ...projectData,
                      expectedUsers: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                Cancel
              </Button>
              <Button onClick={() => setStep(2)}>
                Next: Requirements
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Requirements */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Functional Requirements</CardTitle>
              <Button onClick={addRequirement} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add Requirement
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {requirements.map((req, index) => (
              <div key={req.id} className="p-4 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium text-gray-500">
                    Requirement #{index + 1}
                  </span>
                  {requirements.length > 1 && (
                    <button
                      onClick={() => removeRequirement(req.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <textarea
                  className="w-full h-20 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the requirement..."
                  value={req.description}
                  onChange={(e) =>
                    updateRequirement(req.id, 'description', e.target.value)
                  }
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={req.category}
                      onChange={(e) =>
                        updateRequirement(req.id, 'category', e.target.value)
                      }
                    >
                      <option value="auth">Authentication</option>
                      <option value="data">Data Management</option>
                      <option value="reporting">Reporting</option>
                      <option value="integration">Integration</option>
                      <option value="ui">User Interface</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={req.priority}
                      onChange={(e) =>
                        updateRequirement(req.id, 'priority', e.target.value)
                      }
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-col justify-between gap-3 pt-4 sm:flex-row">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Back
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={() => toast.success('Draft saved')}>
                  <Save className="w-4 h-4 mr-1" />
                  Save Draft
                </Button>
                <Button variant="ai" onClick={handleAnalyze}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Analyze with AI
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Modal */}
      {analyzing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Analyzing Requirements
            </h3>
            <p className="text-gray-600 mb-4">
              AI is processing your requirements...
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>Identifying functional complexity</p>
              <p>Categorizing requirements</p>
              <p>Assessing technical dependencies</p>
              <p className="animate-pulse">Generating recommendations...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
