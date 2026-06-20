import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores:['dist/**','dist2/**','dist_v2/**','node_modules/**','bitacora-dashboard/**','supabase/functions/**'] },
  js.configs.recommended,
  {
    files:['**/*.{js,jsx,mjs,cjs}'],
    languageOptions:{
      ecmaVersion:'latest',
      sourceType:'module',
      parserOptions:{ ecmaFeatures:{ jsx:true } },
      globals:{ ...globals.browser, ...globals.node, ...globals.serviceworker },
    },
    plugins:{
      'react-hooks':reactHooks,
      'react-refresh':reactRefresh,
    },
    rules:{
      'react-hooks/rules-of-hooks':'error',
      'react-hooks/exhaustive-deps':'warn',
      'no-unused-vars':'off',
      'no-empty':'off',
      'no-useless-escape':'warn',
      'react-refresh/only-export-components':'off',
    },
  },
]
