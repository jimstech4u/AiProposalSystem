import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, Calculator, Check, Download, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { extractJsonObject, generateWithGemini, getGeminiErrorMessage } from '../../../lib/gemini';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, saveJson } from '../../../lib/storage';
import { insertRow, selectRows } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';
import { formatCurrency } from '../../../lib/format';

type ProjectRow = {
  id: string;
  title: string;
  description?: string | null;
  project_type?: string | null;
  requirements_text?: string | null;
  complexity_score?: number | null;
  confidence_score?: number | null;
};

type EstimateRow = {
  id: string;
  project_id: string;
  currency: string;
  development_cost: number;
  infrastructure_cost: number;
  third_party_cost: number;
  contingency_percent: number;
  contingency_amount: number;
  total_cost: number;
  min_cost?: number | null;
  max_cost?: number | null;
  confidence_score?: number | null;
  assumptions?: string[] | null;
  created_at: string;
};

type EstimateItemRow = {
  module_name: string;
  resource_role?: string | null;
  hours: number;
  hourly_rate: number;
  multiplier: number;
  amount?: number | null;
};

type RepositoryRow = {
  project_type?: string | null;
  estimated_cost?: number | null;
  actual_cost?: number | null;
};

type ModuleCost = {
  name: string;
  role: string;
  hours: number;
  rate: number;
  multiplier: number;
  cost: number;
  complexity: 'Low' | 'Medium' | 'High';
  confidence: number;
};

type CostSlice = {
  name: string;
  value: number;
  color: string;
};

const colors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed'];

function cleanNumber(value: unknown, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function localEstimateFromProject(project: ProjectRow | null, latestAnalysis: any, baseRate: number): ModuleCost[] {
  const rawRequirements = project?.requirements_text
    ? project.requirements_text.split(/\r?\n/)
    : (latestAnalysis?.requirements ?? []).map((item: any) => item.description);
  const requirements = rawRequirements.map((item: string) => String(item ?? '').trim()).filter(Boolean);
  const source = requirements.length ? requirements : ['Discovery and planning', 'Core application build', 'Testing and deployment'];
  const complexityScore = cleanNumber(project?.complexity_score ?? latestAnalysis?.summary?.complexityScore * 10, 55);

  return source.slice(0, 8).map((requirement: string, index: number) => {
    const complexity = complexityScore >= 70 ? 'High' : complexityScore >= 45 ? 'Medium' : 'Low';
    const multiplier = complexity === 'High' ? 1.35 : complexity === 'Low' ? 0.85 : 1;
    const hours = Math.max(24, Math.round((complexityScore / 2) + 18 + index * 4));
    const cost = hours * baseRate * multiplier;
    return {
      name: requirement.slice(0, 42),
      role: index % 3 === 0 ? 'Senior Engineer' : index % 3 === 1 ? 'Software Engineer' : 'QA / DevOps',
      hours,
      rate: baseRate,
      multiplier,
      cost,
      complexity,
      confidence: Math.round(cleanNumber(project?.confidence_score ?? latestAnalysis?.summary?.confidenceScore, 82)),
    };
  });
}

function itemsToModules(items: EstimateItemRow[]): ModuleCost[] {
  return items.map((item) => {
    const multiplier = cleanNumber(item.multiplier, 1);
    const amount = cleanNumber(item.amount, cleanNumber(item.hours) * cleanNumber(item.hourly_rate) * multiplier);
    return {
      name: item.module_name,
      role: item.resource_role || 'Software Engineer',
      hours: cleanNumber(item.hours),
      rate: cleanNumber(item.hourly_rate),
      multiplier,
      cost: amount,
      complexity: multiplier >= 1.25 ? 'High' : multiplier <= 0.9 ? 'Low' : 'Medium',
      confidence: 85,
    };
  });
}

export default function CostEstimation() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { returnTo?: string; projectId?: string | null } | null;
  const returnTo = routeState?.returnTo ?? '/proposals/new';
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const latestProjectId = readJson<string | null>('latestProjectId', null);
  const session = getStoredSession();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [repository, setRepository] = useState<RepositoryRow[]>([]);
  const [projectId, setProjectId] = useState(routeState?.projectId ?? latestProjectId ?? '');
  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [moduleData, setModuleData] = useState<ModuleCost[]>(readJson<ModuleCost[]>('latestCostModules', []));
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [baseRate, setBaseRate] = useState(15000);
  const [infrastructureCost, setInfrastructureCost] = useState(250000);
  const [thirdPartyCost, setThirdPartyCost] = useState(150000);
  const [contingencyPercent, setContingencyPercent] = useState(10);

  const selectedProject = useMemo(() => projects.find((project) => project.id === projectId) ?? null, [projectId, projects]);
  const developmentCost = moduleData.reduce((sum, item) => sum + cleanNumber(item.cost), 0);
  const contingencyAmount = (developmentCost + infrastructureCost + thirdPartyCost) * (contingencyPercent / 100);
  const totalCost = developmentCost + infrastructureCost + thirdPartyCost + contingencyAmount;
  const totalHours = moduleData.reduce((sum, item) => sum + cleanNumber(item.hours), 0);
  const confidenceScore = estimate?.confidence_score ?? (moduleData.length ? Math.round(moduleData.reduce((sum, item) => sum + item.confidence, 0) / moduleData.length) : 0);
  const costBreakdown: CostSlice[] = [
    { name: 'Development', value: developmentCost, color: colors[0] },
    { name: 'Infrastructure', value: infrastructureCost, color: colors[1] },
    { name: 'Third-party Services', value: thirdPartyCost, color: colors[2] },
    { name: 'Contingency', value: contingencyAmount, color: colors[3] },
  ].filter((item) => item.value > 0);
  const historicalMatches = repository.filter((item) => item.project_type && item.project_type === selectedProject?.project_type);
  const historicalAverage = historicalMatches.length
    ? historicalMatches.reduce((sum, item) => sum + cleanNumber(item.actual_cost ?? item.estimated_cost), 0) / historicalMatches.length
    : 0;
  const historicalDelta = historicalAverage ? ((totalCost - historicalAverage) / historicalAverage) * 100 : null;

  async function loadProjectEstimate(nextProjectId = projectId) {
    if (!nextProjectId) return;
    const estimates = await selectRows<EstimateRow>('cost_estimations', `select=*&project_id=eq.${nextProjectId}&order=created_at.desc&limit=1`);
    const latestEstimate = estimates[0] ?? null;
    setEstimate(latestEstimate);
    if (!latestEstimate) return;

    setInfrastructureCost(cleanNumber(latestEstimate.infrastructure_cost));
    setThirdPartyCost(cleanNumber(latestEstimate.third_party_cost));
    setContingencyPercent(cleanNumber(latestEstimate.contingency_percent, 10));
    const items = await selectRows<EstimateItemRow>('cost_estimation_items', `select=module_name,resource_role,hours,hourly_rate,multiplier,amount&estimation_id=eq.${latestEstimate.id}`);
    const modules = itemsToModules(items);
    const savedDevelopmentCost = cleanNumber(latestEstimate.development_cost);
    const moduleTotal = modules.reduce((sum, item) => sum + cleanNumber(item.cost), 0);
    const normalizedModules = modules.length && moduleTotal > 0 && savedDevelopmentCost > 0
      ? modules.map((item) => ({ ...item, cost: Math.round(cleanNumber(item.cost) * (savedDevelopmentCost / moduleTotal)) }))
      : modules;
    if (normalizedModules.length) {
      const normalizedTotal = normalizedModules.reduce((sum, item) => sum + cleanNumber(item.cost), 0);
      normalizedModules[normalizedModules.length - 1] = {
        ...normalizedModules[normalizedModules.length - 1],
        cost: cleanNumber(normalizedModules[normalizedModules.length - 1].cost) + (savedDevelopmentCost - normalizedTotal),
      };
    }
    const nextModules = modules.length
      ? normalizedModules
      : [{
          name: 'Saved development estimate',
          role: 'Project team',
          hours: 0,
          rate: 0,
          multiplier: 1,
          cost: savedDevelopmentCost,
          complexity: 'saved',
          confidence: cleanNumber(latestEstimate.confidence_score, 0),
        }];
    setModuleData(nextModules);
    saveJson('latestCostModules', nextModules);
  }

  useEffect(() => {
    async function load() {
      try {
        const [projectRows, repositoryRows] = await Promise.all([
          selectRows<ProjectRow>('projects', 'select=id,title,description,project_type,requirements_text,complexity_score,confidence_score&order=created_at.desc'),
          selectRows<RepositoryRow>('project_repository', 'select=project_type,estimated_cost,actual_cost'),
        ]);
        setProjects(projectRows);
        setRepository(repositoryRows);
        const activeProjectId = projectId || projectRows[0]?.id || '';
        setProjectId(activeProjectId);
        if (activeProjectId) await loadProjectEstimate(activeProjectId);
      } catch (error) {
        toast.error('Unable to load cost estimation data.');
        console.warn(error);
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectProject = async (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setEstimate(null);
    setModuleData([]);
    if (nextProjectId) await loadProjectEstimate(nextProjectId);
  };

  const exportCost = () => {
    downloadTextFile(
      'cost-estimation-report.txt',
      toReport('AI Cost Estimation Report', [
        { heading: 'Project', body: selectedProject?.title || 'No project selected' },
        { heading: 'Total Estimated Cost', body: formatCurrency(totalCost) },
        { heading: 'Range', body: `${formatCurrency(totalCost * 0.85)} - ${formatCurrency(totalCost * 1.15)}` },
        { heading: 'Module Breakdown', body: moduleData.map((item) => `- ${item.name}: ${item.hours} hours x ${formatCurrency(item.rate)}/hr x ${item.multiplier} = ${formatCurrency(item.cost)}`).join('\n') },
        { heading: 'Cost Distribution', body: costBreakdown.map((item) => `- ${item.name}: ${formatCurrency(item.value)}`).join('\n') },
      ])
    );
  };

  const saveEstimate = async (
    modules: ModuleCost[],
    overrides: { infrastructure?: number; thirdParty?: number; contingency?: number } = {}
  ) => {
    if (!projectId) throw new Error('Select a saved project before saving a cost estimate.');
    const nextInfrastructure = overrides.infrastructure ?? infrastructureCost;
    const nextThirdParty = overrides.thirdParty ?? thirdPartyCost;
    const nextContingencyPercent = overrides.contingency ?? contingencyPercent;
    const nextDevelopmentCost = modules.reduce((sum, item) => sum + cleanNumber(item.cost), 0);
    const nextContingencyAmount = (nextDevelopmentCost + nextInfrastructure + nextThirdParty) * (nextContingencyPercent / 100);
    const nextTotal = nextDevelopmentCost + nextInfrastructure + nextThirdParty + nextContingencyAmount;
    const [savedEstimate] = await insertRow<EstimateRow>('cost_estimations', {
      project_id: projectId,
      created_by: session?.userId ?? null,
      currency: 'NGN',
      development_cost: nextDevelopmentCost,
      infrastructure_cost: nextInfrastructure,
      third_party_cost: nextThirdParty,
      contingency_percent: nextContingencyPercent,
      contingency_amount: nextContingencyAmount,
      total_cost: nextTotal,
      min_cost: nextTotal * 0.85,
      max_cost: nextTotal * 1.15,
      confidence_score: modules.length ? Math.round(modules.reduce((sum, item) => sum + item.confidence, 0) / modules.length) : 80,
      assumptions: latestAnalysis?.missingRequirements ?? ['Estimate should be reviewed after final scope confirmation.'],
    } as EstimateRow);

    if (savedEstimate?.id) {
      await Promise.all(
        modules.map((item) =>
          insertRow('cost_estimation_items', {
            estimation_id: savedEstimate.id,
            module_name: item.name,
            resource_role: item.role,
            hours: item.hours,
            hourly_rate: item.rate,
            multiplier: item.multiplier,
          })
        )
      );
      setEstimate(savedEstimate);
    }
  };

  const recalculate = async () => {
    setCalculating(true);
    try {
      const prompt = `Create a realistic software project cost estimate in NGN.
Return only valid JSON: {moduleData:[{name,role,hours,rate,multiplier,cost,complexity,confidence}], infrastructureCost, thirdPartyCost, contingencyPercent}.
Use these controls: base hourly rate ${baseRate}, infrastructure baseline ${infrastructureCost}, third-party baseline ${thirdPartyCost}, contingency ${contingencyPercent}%.
Project: ${JSON.stringify(selectedProject)}
Analysis: ${JSON.stringify(latestAnalysis)}`;
      const generated = extractJsonObject(await generateWithGemini(prompt), {});
      const modules = (generated.moduleData?.length ? generated.moduleData : localEstimateFromProject(selectedProject, latestAnalysis, baseRate)).map((item: any) => ({
        name: String(item.name ?? 'Project module'),
        role: String(item.role ?? 'Software Engineer'),
        hours: cleanNumber(item.hours, 40),
        rate: cleanNumber(item.rate, baseRate),
        multiplier: cleanNumber(item.multiplier, item.complexity === 'High' ? 1.35 : item.complexity === 'Low' ? 0.85 : 1),
        cost: cleanNumber(item.cost, cleanNumber(item.hours, 40) * cleanNumber(item.rate, baseRate) * cleanNumber(item.multiplier, 1)),
        complexity: ['Low', 'Medium', 'High'].includes(item.complexity) ? item.complexity : 'Medium',
        confidence: cleanNumber(item.confidence, 82),
      }));
      const nextInfrastructure = cleanNumber(generated.infrastructureCost, infrastructureCost);
      const nextThirdParty = cleanNumber(generated.thirdPartyCost, thirdPartyCost);
      const nextContingency = cleanNumber(generated.contingencyPercent, contingencyPercent);
      setInfrastructureCost(nextInfrastructure);
      setThirdPartyCost(nextThirdParty);
      setContingencyPercent(nextContingency);
      setModuleData(modules);
      saveJson('latestCostModules', modules);
      await saveEstimate(modules, { infrastructure: nextInfrastructure, thirdParty: nextThirdParty, contingency: nextContingency });
      toast.success('Cost estimate generated and saved online.');
    } catch (error) {
      const modules = localEstimateFromProject(selectedProject, latestAnalysis, baseRate);
      setModuleData(modules);
      saveJson('latestCostModules', modules);
      try {
        await saveEstimate(modules);
        toast.warning(`Saved a local cost estimate. ${getGeminiErrorMessage(error)}`);
      } catch {
        toast.warning(`Local cost estimate prepared. ${getGeminiErrorMessage(error)}`);
      }
      console.warn(error);
    } finally {
      setCalculating(false);
    }
  };

  const saveAndApply = async () => {
    if (!projectId || moduleData.length === 0) {
      toast.error('Select a project and prepare a cost estimate first.');
      return;
    }

    if (!estimate) {
      await saveEstimate(moduleData);
    }
    toast.success('Cost estimate applied to proposal context.');
    navigate(returnTo, { state: { useLatestAnalysis: true, projectId } });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Cost Estimation</h1>
          <p className="text-gray-600 mt-1">Project cost model connected to proposals and repository history</p>
        </div>
        <div className="flex shrink-0 gap-2 sm:gap-3">
          <Link to={returnTo} state={{ useLatestAnalysis: true, projectId }} aria-label="Back to Proposal">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
          </Link>
          <Button variant="outline" onClick={exportCost} aria-label="Export Report" className="h-10 w-10 px-0 sm:w-auto sm:px-4" disabled={moduleData.length === 0}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
          </Button>
          <Button variant="primary" onClick={saveAndApply} aria-label="Save and Apply" className="h-10 w-10 px-0 sm:w-auto sm:px-4" disabled={!projectId || moduleData.length === 0}>
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">Save & Apply</span>
          </Button>
          <Button variant="ai" onClick={recalculate} disabled={calculating || !projectId} aria-label={calculating ? 'Recalculating' : 'Recalculate'} className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{calculating ? 'Recalculating...' : 'Recalculate'}</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 lg:grid-cols-[1.3fr_2fr]">
          <label className="space-y-1 text-sm font-medium text-gray-700">
            Project Source
            <select value={projectId} onChange={(event) => selectProject(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5">
              <option value="">Select saved project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Hourly Rate
              <input type="number" min="0" value={baseRate} onChange={(event) => setBaseRate(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Infrastructure
              <input type="number" min="0" value={infrastructureCost} onChange={(event) => setInfrastructureCost(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700">
              Third-party
              <input type="number" min="0" value={thirdPartyCost} onChange={(event) => setThirdPartyCost(Number(event.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2.5" />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-gray-600">Total Estimated Cost</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{formatCurrency(totalCost)}</p>
            <p className="mt-2 text-xs text-gray-500">{formatCurrency(totalCost * 0.85)} - {formatCurrency(totalCost * 1.15)}</p>
            {confidenceScore > 0 && <Badge variant="success" className="mt-3">{confidenceScore}% confidence</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Development Effort</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalHours} hrs</p>
            <p className="mt-2 text-xs text-gray-500">{moduleData.length} modules</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Contingency</p>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min="0" max="30" value={contingencyPercent} onChange={(event) => setContingencyPercent(Number(event.target.value))} className="min-w-0 flex-1" />
              <span className="w-12 text-right font-bold text-gray-900">{contingencyPercent}%</span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{formatCurrency(contingencyAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Historical Comparison</p>
            <p className="mt-2 flex items-center gap-1 text-2xl font-bold text-slate-900">
              {historicalDelta == null ? <Calculator className="h-6 w-6" /> : historicalDelta > 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              {historicalDelta == null ? 'N/A' : `${historicalDelta.toFixed(1)}%`}
            </p>
            <p className="mt-2 text-xs text-gray-500">{historicalMatches.length} similar records</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cost Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={costBreakdown} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                  {costBreakdown.map((entry, index) => <Cell key={entry.name} fill={entry.color ?? colors[index % colors.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cost by Module</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moduleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-35} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="cost" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Module-wise Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-600">Loading cost estimates...</p>
          ) : moduleData.length === 0 ? (
            <div className="py-10 text-center">
              <Calculator className="mx-auto h-10 w-10 text-gray-400" />
              <h2 className="mt-3 font-semibold text-gray-900">No estimate for this project yet</h2>
              <p className="mt-1 text-sm text-gray-600">Select a saved project and run the estimate to create an online cost record.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Module</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Complexity</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Hours</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Rate</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Multiplier</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-700">Cost</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-700">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleData.map((module, index) => (
                    <tr key={`${module.name}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{module.name}</td>
                      <td className="px-4 py-3 text-gray-700">{module.role}</td>
                      <td className="px-4 py-3"><Badge variant={module.complexity === 'High' ? 'danger' : module.complexity === 'Medium' ? 'warning' : 'success'}>{module.complexity}</Badge></td>
                      <td className="px-4 py-3 text-right text-gray-700">{module.hours}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(module.rate)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{module.multiplier}x</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(module.cost)}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{module.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
