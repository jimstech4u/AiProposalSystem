import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Sparkles, Download, TrendingUp, TrendingDown } from 'lucide-react';
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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { extractJsonObject, generateWithGemini, getGeminiErrorMessage } from '../../../lib/gemini';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson, saveJson } from '../../../lib/storage';
import { insertRow } from '../../../lib/supabase';
import { getStoredSession } from '../../../lib/permissions';
import { formatCurrency } from '../../../lib/format';

export default function CostEstimation() {
  const latestAnalysis = readJson<any>('latestAnalysis', null);
  const projectId = readJson<string | null>('latestProjectId', null);
  const session = getStoredSession();
  const [calculating, setCalculating] = useState(false);
  const [moduleData, setModuleData] = useState(readJson<any[]>('latestCostModules', []));

  const [costBreakdown, setCostBreakdown] = useState(readJson<any[]>('latestCostBreakdown', []));

  const totalCost = costBreakdown.reduce((sum, item) => sum + item.value, 0);
  const totalHours = moduleData.reduce((sum, item) => sum + Number(item.hours || 0), 0);
  const avgModuleCost = moduleData.length ? moduleData.reduce((sum, item) => sum + Number(item.cost || 0), 0) / moduleData.length : 0;

  const exportCost = () => {
    downloadTextFile(
      'cost-estimation-report.txt',
      toReport('AI Cost Estimation Report', [
        { heading: 'Total Estimated Cost', body: formatCurrency(totalCost) },
        { heading: 'Module Breakdown', body: moduleData.map((item) => `- ${item.name}: ${item.hours} hours at ${formatCurrency(item.rate)}/hr = ${formatCurrency(item.cost)}`).join('\n') },
        { heading: 'Cost Distribution', body: costBreakdown.map((item) => `- ${item.name}: ${formatCurrency(item.value)}`).join('\n') },
      ])
    );
  };

  const recalculate = async () => {
    setCalculating(true);
    try {
      const prompt = `Create a software project cost estimate from this analysis. Return only valid JSON: {moduleData:[{name,hours,rate,cost,complexity,confidence}], costBreakdown:[{name,value,color}]}.
Analysis: ${JSON.stringify(latestAnalysis)}`;
      const generated = extractJsonObject(await generateWithGemini(prompt), { moduleData, costBreakdown });
      setModuleData(generated.moduleData);
      setCostBreakdown(generated.costBreakdown);
      saveJson('latestCostModules', generated.moduleData);
      saveJson('latestCostBreakdown', generated.costBreakdown);
      if (projectId) {
        const generatedTotal = generated.costBreakdown.reduce((sum: number, item: any) => sum + Number(item.value || 0), 0);
        const developmentCost = generated.moduleData.reduce((sum: number, item: any) => sum + Number(item.cost || 0), 0);
        const thirdParty = generated.costBreakdown.find((item: any) => String(item.name).toLowerCase().includes('third'))?.value ?? 0;
        const infrastructure = generated.costBreakdown.find((item: any) => String(item.name).toLowerCase().includes('infrastructure'))?.value ?? 0;
        const [estimate] = await insertRow('cost_estimations', {
          project_id: projectId,
          created_by: session?.userId ?? null,
          currency: 'NGN',
          development_cost: developmentCost,
          infrastructure_cost: infrastructure,
          third_party_cost: thirdParty,
          contingency_percent: 10,
          contingency_amount: generatedTotal * 0.1,
          total_cost: generatedTotal,
          min_cost: generatedTotal * 0.85,
          max_cost: generatedTotal * 1.15,
          confidence_score: 85,
          assumptions: latestAnalysis?.missingRequirements ?? [],
        });
        if ((estimate as any)?.id) {
          await Promise.all(
            generated.moduleData.map((item: any) =>
              insertRow('cost_estimation_items', {
                estimation_id: (estimate as any).id,
                module_name: item.name,
                resource_role: 'Software Engineer',
                hours: Number(item.hours || 0),
                hourly_rate: Number(item.rate || 0),
                multiplier: item.complexity === 'High' ? 1.3 : item.complexity === 'Low' ? 0.85 : 1,
              })
            )
          );
        }
      }
      toast.success('Cost estimate recalculated with Gemini.');
    } catch (error) {
      toast.warning(`Cost estimate retained. ${getGeminiErrorMessage(error)}`);
      console.warn(error);
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Cost Estimation</h1>
          <p className="text-gray-600 mt-1">AI-powered project cost breakdown</p>
        </div>
        <div className="flex shrink-0 gap-2 sm:gap-3">
          <Button variant="outline" onClick={exportCost} aria-label="Export Report" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
          </Button>
          <Button variant="ai" onClick={recalculate} disabled={calculating} aria-label={calculating ? 'Recalculating' : 'Recalculate'} className="h-10 w-10 px-0 sm:w-auto sm:px-4">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">{calculating ? 'Recalculating...' : 'Recalculate'}</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total Estimated Cost</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(totalCost)}
              </p>
              <p className="text-xs text-gray-500 mt-2">Generated from current analysis</p>
              <div className="mt-3">
                <Badge variant="success" className="gap-1">
                  <Sparkles className="w-3 h-3" />
                  89% Confidence
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Development Effort</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalHours} hrs</p>
              <p className="text-sm text-gray-600 mt-2">From saved estimate</p>
              <p className="text-xs text-gray-500 mt-1">Recalculate after analysis</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">Avg Cost per Module</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(Math.round(avgModuleCost))}</p>
              <p className="text-sm text-gray-600 mt-2">{moduleData.length} modules</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-gray-600">vs Similar Projects</p>
              <p className="text-3xl font-bold text-slate-900 mt-2 flex items-center justify-center gap-1">
                {totalCost > 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                {totalCost > 0 ? 'Recorded' : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-2">Historical comparison unavailable</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {costBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Module Costs */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Module</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={moduleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="cost" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Module Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Module-wise Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Module</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Complexity</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Hours</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Rate</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Cost</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {moduleData.map((module, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{module.name}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          module.complexity === 'High'
                            ? 'danger'
                            : module.complexity === 'Medium'
                            ? 'warning'
                            : 'success'
                        }
                      >
                        {module.complexity}
                      </Badge>
                    </td>
                    <td className="text-right py-3 px-4 text-gray-700">{module.hours} hrs</td>
                    <td className="text-right py-3 px-4 text-gray-700">{formatCurrency(module.rate)}/hr</td>
                    <td className="text-right py-3 px-4 font-medium text-gray-900">
                      {formatCurrency(module.cost)}
                    </td>
                    <td className="text-center py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-sm font-medium text-gray-900">{module.confidence}%</span>
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="py-3 px-4">Total Development</td>
                  <td className="py-3 px-4"></td>
                  <td className="text-right py-3 px-4">
                    {moduleData.reduce((sum, m) => sum + m.hours, 0)} hrs
                  </td>
                  <td className="py-3 px-4"></td>
                  <td className="text-right py-3 px-4">
                    {formatCurrency(moduleData.reduce((sum, m) => sum + m.cost, 0))}
                  </td>
                  <td className="py-3 px-4"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {costBreakdown.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-gray-600">
            No cost estimate exists yet. Run the Gemini recalculation after completing requirement analysis.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
