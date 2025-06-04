'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function IndividualEvaluation() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [summaryData, setSummaryData] = useState({
    대분류별: {},
    중분류별: {},
    담당자별: {},
    전체점수: { total: 0, max: 0, percentage: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [selectedManager, setSelectedManager] = useState('전체'); // 기본값을 '전체'로 설정
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    loadProjectEvaluation();
  }, [params.id]);

  const loadProjectEvaluation = async () => {
    try {
      // 프로젝트 정보 가져오기
      const projectsRes = await fetch('/api/projects');
      const projects = await projectsRes.json();
      const currentProject = projects.find(p => p.id === parseInt(params.id));
      
      if (!currentProject) {
        throw new Error('프로젝트를 찾을 수 없습니다.');
      }
      
      setProject(currentProject);

      // 프로젝트 데이터 로드
      const excelRes = await fetch('/api/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: currentProject.filePath })
      });
      
      const excelData = await excelRes.json();
      
      if (excelData.success && excelData.data && excelData.data.length > 1) {
        const processedData = [];
        let prev대분류 = "";
        
        for (let i = 1; i < excelData.data.length; i++) {
          const row = excelData.data[i];
          if (!row || row.length === 0) continue;
          
          // 대분류가 비어있으면 이전 값 사용
          if (row[0]?.value) {
            prev대분류 = row[0].value;
          }
          
          // 점수 처리
          const score = safeParseNumber(row[5]?.value, 0);
          const scoreRange = safeParseScoreRange(row[6]?.value);
          const maxScore = scoreRange.max;
          
          processedData.push({
            대분류: row[0]?.value || prev대분류,
            중분류: row[1]?.value || '',
            소분류: row[2]?.value || '',
            임무: row[3]?.value || '',
            담당자: row[4]?.value || '',
            점수: score,
            최대점수: maxScore,
            점수범위: `${scoreRange.min}/${scoreRange.max}`
          });
        }
        
        // 데이터 집계
        const summary = calculateSummary(processedData);
        setSummaryData(summary);
      }
    } catch (error) {
      console.error('Failed to load project evaluation:', error);
    } finally {
      setLoading(false);
    }
  };

  // 안전한 숫자 파싱 함수
  const safeParseNumber = (value, defaultValue = 0) => {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  };

  // 안전한 점수범위 파싱 함수
  const safeParseScoreRange = (value) => {
    const defaultRange = { min: 0, max: 1 };
    
    if (!value) return defaultRange;
    
    const strValue = String(value).trim();
    if (!strValue || !strValue.includes('/')) return defaultRange;
    
    try {
      const parts = strValue.split('/');
      if (parts.length !== 2) return defaultRange;
      
      const min = safeParseNumber(parts[0], 0);
      const max = safeParseNumber(parts[1], 1);
      
      return { min, max };
    } catch (error) {
      return defaultRange;
    }
  };

  const calculateSummary = (data) => {
    const summary = {
      대분류별: {},
      중분류별: {},
      담당자별: {}
    };
    
    let totalScore = 0;
    let totalMaxScore = 0;
    
    data.forEach(item => {
      totalScore += item.점수;
      totalMaxScore += item.최대점수;
      
      // 대분류별 집계
      if (!summary.대분류별[item.대분류]) {
        summary.대분류별[item.대분류] = {
          점수합: 0,
          최대점수합: 0,
          항목수: 0,
          담당자목록: new Set(),
          중분류: {}
        };
      }
      summary.대분류별[item.대분류].점수합 += item.점수;
      summary.대분류별[item.대분류].최대점수합 += item.최대점수;
      summary.대분류별[item.대분류].항목수 += 1;
      summary.대분류별[item.대분류].담당자목록.add(item.담당자);
      
      // 중분류별 집계
      if (!summary.대분류별[item.대분류].중분류[item.중분류]) {
        summary.대분류별[item.대분류].중분류[item.중분류] = {
          점수합: 0,
          최대점수합: 0,
          항목수: 0,
          소분류: {}
        };
      }
      summary.대분류별[item.대분류].중분류[item.중분류].점수합 += item.점수;
      summary.대분류별[item.대분류].중분류[item.중분류].최대점수합 += item.최대점수;
      summary.대분류별[item.대분류].중분류[item.중분류].항목수 += 1;
      
      // 소분류가 있는 경우
      if (item.소분류) {
        if (!summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류]) {
          summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류] = {
            점수합: 0,
            최대점수합: 0,
            항목수: 0
          };
        }
        summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류].점수합 += item.점수;
        summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류].최대점수합 += item.최대점수;
        summary.대분류별[item.대분류].중분류[item.중분류].소분류[item.소분류].항목수 += 1;
      }
      
      // 담당자별 집계
      if (!summary.담당자별[item.담당자]) {
        summary.담당자별[item.담당자] = {
          점수합: 0,
          최대점수합: 0,
          항목수: 0,
          대분류별: {}
        };
      }
      summary.담당자별[item.담당자].점수합 += item.점수;
      summary.담당자별[item.담당자].최대점수합 += item.최대점수;
      summary.담당자별[item.담당자].항목수 += 1;
      
      // 담당자별 대분류별 집계
      if (!summary.담당자별[item.담당자].대분류별[item.대분류]) {
        summary.담당자별[item.담당자].대분류별[item.대분류] = {
          점수합: 0,
          최대점수합: 0,
          중분류별: {}
        };
      }
      summary.담당자별[item.담당자].대분류별[item.대분류].점수합 += item.점수;
      summary.담당자별[item.담당자].대분류별[item.대분류].최대점수합 += item.최대점수;
      
      // 담당자별 중분류별 집계
      if (!summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류]) {
        summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류] = {
          점수합: 0,
          최대점수합: 0,
          소분류별: {}
        };
      }
      summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].점수합 += item.점수;
      summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].최대점수합 += item.최대점수;
      
      // 담당자별 소분류별 집계
      if (item.소분류) {
        if (!summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류]) {
          summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류] = {
            점수합: 0,
            최대점수합: 0
          };
        }
        summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류].점수합 += item.점수;
        summary.담당자별[item.담당자].대분류별[item.대분류].중분류별[item.중분류].소분류별[item.소분류].최대점수합 += item.최대점수;
      }
    });
    
    summary.전체점수 = {
      total: totalScore,
      max: totalMaxScore,
      percentage: totalMaxScore > 0 ? (totalScore / totalMaxScore * 100).toFixed(1) : 0
    };
    
    return summary;
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 90) return 'text-green-600 bg-green-100';
    if (percentage >= 80) return 'text-blue-600 bg-blue-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const handleBack = () => {
    router.push('/');
  };

  // 선택된 담당자에 따른 전체 점수 계산
  const getSelectedManagerScore = () => {
    if (selectedManager === '전체') {
      return summaryData.전체점수;
    } else {
      const managerData = summaryData.담당자별[selectedManager];
      if (managerData) {
        const percentage = managerData.최대점수합 > 0 
          ? (managerData.점수합 / managerData.최대점수합 * 100).toFixed(1) 
          : 0;
        return {
          total: managerData.점수합,
          max: managerData.최대점수합,
          percentage: percentage
        };
      }
    }
    return { total: 0, max: 0, percentage: 0 };
  };

  // 선택된 담당자에 따른 대분류별 데이터 가져오기
  const getSelectedManagerCategories = () => {
    if (selectedManager === '전체') {
      return summaryData.대분류별;
    } else {
      const managerData = summaryData.담당자별[selectedManager];
      return managerData ? managerData.대분류별 : {};
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">평가 데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">프로젝트를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const selectedScore = getSelectedManagerScore();
  const selectedCategories = getSelectedManagerCategories();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project.projectName} - 평가 집계표
              </h1>
              <div className="text-sm text-gray-500 mt-1 grid grid-cols-2 gap-x-6">
                <div>현장위치: {project.location}</div>
                <div>총괄담당자: {project.generalManager}</div>
                <div>검수자: {project.inspector}</div>
                <div>검수일자: {project.inspectionDate}</div>
              </div>
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              목록으로
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 1. 담당자 선택 (맨 위로 이동) */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">담당자별 평가 보기</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* 전체 버튼 */}
            <button
              onClick={() => {
                setSelectedManager('전체');
                setSelectedCategory(null);
              }}
              className={`p-3 rounded-lg border text-center transition-colors ${
                selectedManager === '전체'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">전체 인원</div>
              <div className="text-sm opacity-80">
                {summaryData.전체점수.total}/{summaryData.전체점수.max}
              </div>
              <div className="text-xs opacity-70">
                ({summaryData.전체점수.percentage}%)
              </div>
            </button>

            {/* 각 담당자 버튼 */}
            {Object.entries(summaryData.담당자별).map(([manager, data]) => {
              const percentage = data.최대점수합 > 0 
                ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                : 0;
              
              return (
                <button
                  key={manager}
                  onClick={() => {
                    setSelectedManager(manager);
                    setSelectedCategory(null);
                  }}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    selectedManager === manager
                      ? 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium truncate" title={manager}>
                    {manager}
                  </div>
                  <div className="text-sm opacity-80">
                    {data.점수합}/{data.최대점수합}
                  </div>
                  <div className="text-xs opacity-70">
                    ({percentage}%)
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 선택된 담당자의 전체 점수 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {selectedManager === '전체' ? '전체 인원' : selectedManager} - 전체 평가 점수
          </h2>
          <div className="flex items-baseline space-x-6">
            <div className="text-4xl font-bold text-blue-600">
              {selectedScore.total}/{selectedScore.max}
            </div>
            <div className="text-3xl font-semibold text-gray-600">
              ({selectedScore.percentage}%)
            </div>
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${selectedScore.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. 선택된 담당자의 업무별 집계 */}
        <div className="space-y-4">
          {/* 대분류 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(selectedCategories).map(([category, data]) => {
              const percentage = data.최대점수합 > 0 
                ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                : 0;
              
              return (
                <div 
                  key={category}
                  className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedCategory(category)}
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">{category}</h3>
                  <div className="text-3xl font-bold text-blue-600 mb-1">
                    {data.점수합}/{data.최대점수합}
                  </div>
                  <div className="text-xl text-gray-600 mb-2">
                    ({percentage}%)
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        percentage >= 90 ? 'bg-green-500' :
                        percentage >= 80 ? 'bg-blue-500' :
                        percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {selectedManager === '전체' && (
                    <div className="text-sm text-gray-500 mt-2">
                      {summaryData.대분류별[category]?.항목수}개 항목 | {Array.from(summaryData.대분류별[category]?.담당자목록 || []).length}명 담당자
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 선택된 대분류의 중분류 상세 */}
          {selectedCategory && selectedCategories[selectedCategory] && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-semibold mb-1">
                {selectedCategory} - 중분류별 상세
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                담당자: {selectedManager === '전체' ? '전체 담당자 합산' : selectedManager}
              </p>
              <div className="space-y-3">
                {Object.entries(selectedCategories[selectedCategory].중분류별 || {}).map(([중분류, data]) => {
                  const percentage = data.최대점수합 > 0 
                    ? (data.점수합 / data.최대점수합 * 100).toFixed(1) 
                    : 0;
                  
                  return (
                    <div key={중분류} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-medium">{중분류}</h4>
                        <div className="flex items-center space-x-4">
                          <span className="text-lg font-semibold">
                            {data.점수합}/{data.최대점수합}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(percentage)}`}>
                            {percentage}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            percentage >= 90 ? 'bg-green-500' :
                            percentage >= 80 ? 'bg-blue-500' :
                            percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      
                      {/* 소분류가 있는 경우 */}
                      {Object.keys(data.소분류별 || {}).length > 0 && (
                        <div className="mt-3 ml-4 space-y-1">
                          {Object.entries(data.소분류별 || {}).map(([소분류, 소data]) => {
                            const 소percentage = 소data.최대점수합 > 0 
                              ? (소data.점수합 / 소data.최대점수합 * 100).toFixed(1) 
                              : 0;
                            
                            return (
                              <div key={소분류} className="flex justify-between text-sm text-gray-600">
                                <span>└ {소분류}</span>
                                <span className="font-medium">
                                  {소data.점수합}/{소data.최대점수합} ({소percentage}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}