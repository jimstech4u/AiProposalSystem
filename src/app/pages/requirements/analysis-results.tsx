import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Sparkles, Download, AlertTriangle, CheckCircle2, Edit } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { downloadTextFile, toReport } from '../../../lib/export';
import { readJson } from '../../../lib/storage';

const fallbackAnalysis = {
  project: { name: 'No analysis available', client: 'No client selected' },
  generatedAt: new Date().toISOString(),
  summary: { complexityScore: 0, complexityLabel: 'Not analyzed', confidenceScore: 0, totalRequirements: 0 },
  complexity: [],
  categories: [],
  identifiedRequirements: [],
  missingRequirements: [],
  nextSteps: ['Create a requirement analysis to generate project-specific results.'],
};

export default function AnalysisResults() {
  const analysis = readJson('latestAnalysis', fallbackAnalysis) as typeof fallbackAnalysis;
  const hasAnalysis = analysis.project.name !== fallbackAnalysis.project.name && analysis.summary.totalRequirements > 0;

  const exportReport = () => {
    downloadTextFile(
      `${analysis.project.name || 'requirement-analysis'}-report.txt`,
      toReport('AI Requirement Analysis Report', [
        { heading: 'Project', body: `${analysis.project.name} for ${analysis.project.client}` },
        { heading: 'Summary', body: `Complexity: ${analysis.summary.complexityScore}/10 (${analysis.summary.complexityLabel})\nConfidence: ${analysis.summary.confidenceScore}%\nRequirements: ${analysis.summary.totalRequirements}` },
        { heading: 'Identified Requirements', body: analysis.identifiedRequirements.map((item) => `- ${item.description} (${item.priority}, ${item.complexity})`).join('\n') },
        { heading: 'Missing or Ambiguous Requirements', body: analysis.missingRequirements.map((item) => `- ${item.description} (${item.severity})`).join('\n') },
      ])
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-gray-900">Analysis Results</h1>
          <p className="text-gray-600 mt-1">
            {analysis.project.name} - {analysis.project.client} - {new Date(analysis.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 sm:gap-3">
          <Link to="/requirements/new" aria-label="Edit Requirements">
            <Button variant="outline" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Requirements</span>
            </Button>
          </Link>
          <Button variant="secondary" onClick={exportReport} aria-label="Export Report" className="h-10 w-10 px-0 sm:w-auto sm:px-4" disabled={!hasAnalysis}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export Report</span>
          </Button>
          <Link to={hasAnalysis ? '/proposals/new' : '/requirements/new'} aria-label={hasAnalysis ? 'Generate Proposal' : 'Create Analysis'}>
            <Button variant="ai" className="h-10 w-10 px-0 sm:w-auto sm:px-4">
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">{hasAnalysis ? 'Generate Proposal' : 'Create Analysis'}</span>
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-sm border-4 border-amber-500 mb-2">
                <span className="text-3xl font-bold text-amber-600">{analysis.summary.complexityScore}</span>
              </div>
              <p className="font-semibold text-gray-900">Overall Complexity</p>
              <p className="text-sm text-gray-600">{analysis.summary.complexityLabel}</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-sm border-4 border-green-500 mb-2">
                <span className="text-3xl font-bold text-green-600">{analysis.summary.confidenceScore}%</span>
              </div>
              <p className="font-semibold text-gray-900">Confidence Score</p>
              <p className="text-sm text-gray-600">AI-generated confidence</p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-sm border-4 border-blue-500 mb-2">
                <span className="text-3xl font-bold text-blue-600">{analysis.summary.totalRequirements}</span>
              </div>
              <p className="font-semibold text-gray-900">Total Requirements</p>
              <p className="text-sm text-gray-600">{analysis.categories.length} Categories</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Requirements by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={analysis.categories} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                  {analysis.categories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Complexity Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={analysis.complexity}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 10]} />
                <Radar name="Complexity" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identified Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.identifiedRequirements.map((req) => (
              <div key={req.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{req.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="info">{req.category}</Badge>
                      <Badge variant={req.priority === 'Critical' ? 'danger' : req.priority === 'High' ? 'warning' : 'default'}>{req.priority}</Badge>
                      <Badge variant="default">Complexity: {req.complexity}</Badge>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-900">{req.confidence}%</span>
                      <Sparkles className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">AI Confidence</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-5 h-5" />
            Missing or Ambiguous Requirements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.missingRequirements.map((req, index) => (
              <div key={index} className="p-4 bg-white rounded-lg border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{req.description}</p>
                  <Badge variant={req.severity === 'High' ? 'danger' : 'warning'} className="mt-2">
                    {req.severity} Concern
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Recommended Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {analysis.nextSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">{index + 1}</span>
                <p className="text-gray-900 pt-0.5">{step}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
