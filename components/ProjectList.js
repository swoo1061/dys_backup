import { useState, useCallback, useMemo } from 'react';
import { FaSearch, FaTrash, FaEdit, FaCheck } from 'react-icons/fa';

// 상수 정의
const CONSTANTS = {
  BATCH_SIZE: 5,
  DEBOUNCE_DELAY: 300,
  TABLE_COLUMNS: [
    { id: 'projectName', label: '감리' },
    { id: 'location', label: '위치' },
    { id: 'generalManager', label: '총괄' },
    { id: 'inspector', label: '검수자' },
    { id: 'inspectionDate', label: '검수일자' },
    { id: 'uploadDate', label: '업로드일자' }
  ]
};

// 유틸리티 함수
const utils = {
  formatDate: (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
  },
  debounce: (fn, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
};

// API 호출 유틸리티
const api = {
  deleteProject: async (id) => {
    const response = await fetch('/api/projects', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || '삭제 실패');
    }
    
    return response.json();
  }
};

// 상태 관리 유틸리티
const stateUtils = {
  updateSelectedProjects: (prev, projectId) => {
    if (prev.includes(projectId)) {
      return prev.filter(id => id !== projectId);
    }
    return [...prev, projectId];
  },
  
  updateAllSelected: (prev, filteredProjects) => {
    if (prev.length === filteredProjects.length) {
      return [];
    }
    return filteredProjects.map(p => p.id);
  }
};

export default function ProjectList({ projects = [], onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);

  // 검색어 변경 핸들러 최적화
  const handleSearchChange = useCallback(
    utils.debounce((e) => {
      setSearchTerm(e.target.value);
    }, CONSTANTS.DEBOUNCE_DELAY),
    []
  );

  // 프로젝트 필터링 최적화
  const filteredProjects = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return projects.filter(project =>
      project.projectName?.toLowerCase().includes(term) ||
      project.location?.toLowerCase().includes(term) ||
      project.generalManager?.toLowerCase().includes(term) ||
      project.inspector?.toLowerCase().includes(term)
    );
  }, [projects, searchTerm]);

  // 프로젝트 선택 핸들러 최적화
  const handleProjectSelect = useCallback((projectId) => {
    setSelectedProjects(prev => stateUtils.updateSelectedProjects(prev, projectId));
  }, []);

  // 전체 선택 핸들러 최적화
  const handleSelectAll = useCallback(() => {
    setSelectedProjects(prev => stateUtils.updateAllSelected(prev, filteredProjects));
  }, [filteredProjects]);

  // 일괄 삭제 핸들러 최적화
  const handleBulkDelete = useCallback(async () => {
    if (selectedProjects.length === 0) {
      alert('삭제할 프로젝트를 선택해주세요.');
      return;
    }

    const selectedNames = projects
      .filter(p => selectedProjects.includes(p.id))
      .map(p => p.projectName)
      .join(', ');

    if (!confirm(`선택한 프로젝트들을 삭제하시겠습니까?\n\n${selectedNames}`)) {
      return;
    }

    try {
      setIsDeleting(true);
      const batchSize = CONSTANTS.BATCH_SIZE;
      const results = [];
      
      for (let i = 0; i < selectedProjects.length; i += batchSize) {
        const batch = selectedProjects.slice(i, i + batchSize);
        const batchPromises = batch.map(id => api.deleteProject(id));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      const failures = results.filter(r => !r.success);
      
      if (failures.length === 0) {
        alert(`${selectedProjects.length}개 프로젝트가 삭제되었습니다.`);
        setSelectedProjects([]);
        onRefresh?.();
      } else {
        throw new Error(`${failures.length}개 프로젝트 삭제 실패`);
      }
    } catch (error) {
      console.error('일괄 삭제 오류:', error);
      alert('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedProjects, projects, onRefresh]);

  // 업로드 이력 업데이트 최적화
  const updateUploadHistory = useCallback((newHistory) => {
    setUploadHistory(prev => {
      const updated = [...prev, {
        ...newHistory,
        uploader: '관리자',
        date: new Date().toLocaleString()
      }];
      return updated.slice(-5); // 최근 5개만 유지
    });
  }, []);

  // 테이블 헤더 렌더링 최적화
  const renderTableHeader = useMemo(() => (
    <thead>
      <tr className="bg-gray-50">
        <th className="px-4 py-2 border-b">
          <input
            type="checkbox"
            checked={selectedProjects.length === filteredProjects.length}
            onChange={handleSelectAll}
            className="rounded"
          />
        </th>
        {CONSTANTS.TABLE_COLUMNS.map(column => (
          <th key={column.id} className="px-4 py-2 border-b text-left">
            {column.label}
          </th>
        ))}
        <th className="px-4 py-2 border-b">관리</th>
      </tr>
    </thead>
  ), [selectedProjects.length, filteredProjects.length, handleSelectAll]);

  // 테이블 행 렌더링 최적화
  const renderTableRows = useMemo(() => (
    <tbody>
      {filteredProjects.map((project) => (
        <tr key={project.id} className="hover:bg-gray-50">
          <td className="px-4 py-2 border-b">
            <input
              type="checkbox"
              checked={selectedProjects.includes(project.id)}
              onChange={() => handleProjectSelect(project.id)}
              className="rounded"
            />
          </td>
          <td className="px-4 py-2 border-b">{project.projectName}</td>
          <td className="px-4 py-2 border-b">{project.location}</td>
          <td className="px-4 py-2 border-b">{project.generalManager}</td>
          <td className="px-4 py-2 border-b">{project.inspector}</td>
          <td className="px-4 py-2 border-b">{project.inspectionDate || '-'}</td>
          <td className="px-4 py-2 border-b">{project.uploadDate}</td>
          <td className="px-4 py-2 border-b">
            <div className="flex space-x-2">
              <button
                onClick={() => {/* 수정 기능 구현 */}}
                className="p-1 text-blue-500 hover:text-blue-600"
              >
                <FaEdit />
              </button>
              <button
                onClick={() => {/* 삭제 기능 구현 */}}
                className="p-1 text-red-500 hover:text-red-600"
              >
                <FaTrash />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  ), [filteredProjects, selectedProjects, handleProjectSelect]);

  return (
    <div className="space-y-4">
      {/* 검색 및 일괄 삭제 영역 */}
      <div className="flex justify-between items-center">
        <div className="relative">
          <input
            type="text"
            placeholder="프로젝트 검색..."
            onChange={handleSearchChange}
            className="pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FaSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
        <button
          onClick={handleBulkDelete}
          disabled={selectedProjects.length === 0 || isDeleting}
          className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
            selectedProjects.length === 0 || isDeleting
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          <FaTrash />
          <span>선택 삭제</span>
        </button>
      </div>

      {/* 프로젝트 목록 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          {renderTableHeader}
          {renderTableRows}
        </table>
      </div>
    </div>
  );
}