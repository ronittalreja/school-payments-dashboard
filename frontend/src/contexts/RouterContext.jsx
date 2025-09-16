import React, { createContext, useContext, useState } from 'react';

export const RouterContext = createContext();

export const Router = ({ children }) => {
  const [currentPath, setCurrentPath] = useState('/dashboard');
  const [params, setParams] = useState({});

  const navigate = (path, pathParams = {}) => {
    setCurrentPath(path);
    setParams(pathParams);
  };

  return (
    <RouterContext.Provider value={{ currentPath, navigate, params }}>
      {children}
    </RouterContext.Provider>
  );
};

export const useRouter = () => {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within Router');
  }
  return context;
};