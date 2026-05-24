'use client';
import { useState } from 'react';
import { Upload, FileText, Sparkles } from 'lucide-react';

export default function Home() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [meta, setMeta] = useState<{
    matchScore?: { before: number; after: number };
    missingKeywords?: string[];
    jdTitle?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile || !jobDescription) return;

    setLoading(true);
    setError('');
    setMeta(null);
    setResult('');

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('jobDescription', jobDescription);

    try {
      const response = await fetch('/api/tailor-resume', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error ?? 'Failed to tailor resume');
        return;
      }

      setResult(data.tailoredResume);
      setMeta(data.meta ?? null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-12">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 text-white p-3 rounded-2xl">
              <Sparkles className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-3">
            AI Resume Tailor
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your resume and let AI optimize it for your target job description
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Upload Your Resume (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors rounded-2xl p-10 text-center bg-gray-50">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700">
                  {resumeFile ? resumeFile.name : "Drag & drop your resume here"}
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse (PDF only)</p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="mt-4 inline-block px-6 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium cursor-pointer hover:bg-gray-50 transition"
                >
                  Choose File
                </label>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Job Description
              </label>
              <textarea
                placeholder="Paste the job description here..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={10}
                className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y min-h-[180px] text-gray-700"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !resumeFile || !jobDescription}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                  Analyzing JD & tailoring (may take 30–60s)...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Tailored Resume
                </>
              )}
            </button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="mt-12 bg-white rounded-3xl shadow-xl p-10 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-blue-600" />
                Your Tailored Resume
              </h2>
              <button
                type="button"
                onClick={() => {
                  setResult('');
                  setMeta(null);
                  setError('');
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>

            {meta?.matchScore && (
              <div className="mb-6 flex flex-wrap gap-3">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700">
                  Before: {meta.matchScore.before}%
                </span>
                <span className="inline-flex items-center rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-800">
                  After: {meta.matchScore.after}%
                </span>
                {meta.jdTitle && (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-800">
                    Role: {meta.jdTitle}
                  </span>
                )}
              </div>
            )}

            {meta?.missingKeywords && meta.missingKeywords.length > 0 && (
              <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                Still missing (may need real experience):{' '}
                {meta.missingKeywords.slice(0, 8).join(', ')}
                {meta.missingKeywords.length > 8 ? '…' : ''}
              </p>
            )}

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8">
              <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed text-[15px]">
                {result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}