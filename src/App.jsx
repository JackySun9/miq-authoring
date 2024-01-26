/* eslint-disable react/display-name */
/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  useReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
} from 'reactflow';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from "react-router-dom";
import myUseStore from './store/Store';
import { shallow } from 'zustand/shallow';
import parseData from './utils/ParseData';
import '@spectrum-web-components/top-nav/sp-top-nav.js';
import '@spectrum-web-components/top-nav/sp-top-nav-item.js';

// temporary data for dev testing.
// import questionsData from '/src/assets/questions.json';
// import stringsData from '/src/assets/strings.json';

import QuestionNode from './components/nodes/questions/QuestionNode';
import OptionNode from './components/nodes/options/OptionNode';
import Sidebar from './components/common/sidebar/Sidebar';
import CustomConnectionLine from './components/common/CustomConnectionLine';

import '@spectrum-css/vars/dist/spectrum-global.css';
import '@spectrum-css/vars/dist/spectrum-medium.css';
import '@spectrum-css/vars/dist/spectrum-dark.css';
import '@spectrum-css/tokens/dist/index.css';
import '@spectrum-css/page/dist/index-vars.css';
import '@spectrum-css/typography/dist/index.css';
import '@spectrum-css/icon/dist/index.css';
import '@spectrum-css/button/dist/index.css';
import '@spectrum-css/accordion/dist/index.css';
import '@spectrum-css/site/skin.css';
import '@spectrum-css/fieldlabel/dist/index-vars.css';
import '@spectrum-css/fieldlabel/dist/index.css';
import '@spectrum-css/textfield/dist/index.css';
import '@spectrum-css/textfield/dist/index-vars.css';
import 'reactflow/dist/style.css';

let id = 1;
const getId = () => `node${id++}`;

const nodeWidth = 172;
const nodeHeight = 36;

const layoutGraph = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const ranksep = 100;
  const nodesep = 200;

  dagreGraph.setGraph({ rankdir: direction, ranksep: ranksep, nodesep: nodesep });

  nodes.forEach(node => {
    let width = nodeWidth;
    let height = nodeHeight;
    if (node.type === 'question') {
      height += 1500;
    }

    dagreGraph.setNode(node.id, { width: width, height: height });
  });
  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map(node => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 },
    };
  });
};

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });
};

const fetchFile = async (baseUrl, fileName) => {
  const response = await fetch(`${baseUrl}${fileName}`);
  if (!response.ok) {
    throw new Error(`Error fetching ${fileName}: ${response.statusText}`);
  }
  return response.json();
};

const QuizEditor = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
  } = myUseStore(state => ({
    nodes: state.nodes,
    edges: state.edges,
    onNodesChange: state.onNodesChange,
    onEdgesChange: state.onEdgesChange,
    onConnect: state.onConnect,
    setNodes: state.setNodes,
    setEdges: state.setEdges,
  }), shallow);

  const [parsedNodes, setParsedNodes] = useState([]);
  const [parsedEdges, setParsedEdges] = useState([]);

  const reactFlowInstance = useReactFlow();
  const [initialView, setInitialView] = useState({ x: 0, y: 0, zoom: 1 });
  const [isZoomedIn, setIsZoomedIn] = useState(false);

  const [baseUrl, setBaseUrl] = useState(''); 

  const importData = async (importBaseUrl) => {
    try {
      const questionsData = await fetchFile(importBaseUrl, 'questions.json');
      const stringsData = await fetchFile(importBaseUrl, 'strings.json');
      const resultsData = await fetchFile(importBaseUrl, 'results.json');
      const { nodes: importedNodes, edges: importedEdges } = parseData(questionsData, stringsData);
      const layoutedNodes = layoutGraph(importedNodes, importedEdges);

      setParsedNodes(layoutedNodes);
      setParsedEdges(importedEdges);
      setNodes(layoutedNodes);
      setEdges(importedEdges);

    } catch (error) {
      console.error('Error importing data:', error);
    }
  };

  useEffect(() => {
    setNodes(parsedNodes);
    setEdges(parsedEdges);
  }, [parsedNodes, parsedEdges, setNodes, setEdges]);

  const updateLayout = () => {
    const layoutedNodes = layoutGraph(nodes, edges);
    setNodes(layoutedNodes);
  };

  const handleDoubleClick = useCallback(
    (event, node) => {
      if (reactFlowInstance && !isZoomedIn) {
        setInitialView({ x: reactFlowInstance.viewport.x, y: reactFlowInstance.viewport.y, zoom: reactFlowInstance.viewport.zoom });
        const newX = -node.__rf.position.x + window.innerWidth / 2;
        const newY = -node.__rf.position.y + window.innerHeight / 2;
        reactFlowInstance.setViewport({ x: newX, y: newY, zoom: 2 });
        setIsZoomedIn(true);
      } else if (reactFlowInstance) {
        reactFlowInstance.setViewport(initialView);
        setIsZoomedIn(false);
      }
    },
    [isZoomedIn, initialView, reactFlowInstance]
  );

  const nodeTypes = useMemo(() => ({
    question: (nodeProps) => <QuestionNode {...nodeProps} setNodes={setNodes} setEdges={setEdges} />,
    option: (nodeProps) => <OptionNode {...nodeProps} setNodes={setNodes} setEdges={setEdges} />,
  }), [setNodes, setEdges]); 

  const reactFlowWrapper = useRef(null);
  const connectingNodeId = useRef(null);
  const connectingHandleId = useRef(null);
  const { project } = useReactFlow();

  const onConnectStart = useCallback((event, { nodeId, handleId }) => {
    connectingNodeId.current = nodeId;
    connectingHandleId.current = handleId;
  }, []);

  const isChildNode = (nodeId) => {
    return edges.some(edge => edge.target === nodeId);
  };

  const getParentNodeId = (childNodeId) => {
    const edge = edges.find(edge => edge.target === childNodeId);
    return edge ? edge.source : null;
  };

  const onConnectEnd = useCallback(
    (event) => {
      if (event.target.classList.contains('react-flow__pane')) {
        const newId = getId();
        let newNodeType, newNodeData;

        switch (connectingHandleId.current) {
          case 'newOption':
            newNodeType = 'option';
            newNodeData = { label: `Option ${newId}` };
            break;
          case 'grey':
            newNodeType = 'question';
            newNodeData = { label: `Question ${newId}`, product1: '', product2: '' };
            break;
          default:
            return;
        }

        let position = project({
          x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left,
          y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top
        });

        const newNode = {
          id: newId,
          type: newNodeType,
          data: newNodeData,
          position: position
        };

        const updatedNodes = [...nodes, newNode];
        // Uncomment out next 2 lines to activate auto layout work.
        // const layoutedNodes = layoutGraph(updatedNodes, edges);
        // setNodes(layoutedNodes);

        if (connectingNodeId.current) {
          const newEdge = {
            id: `e${connectingNodeId.current}-${newId}`,
            source: connectingNodeId.current,
            target: newId,
            sourceHandle: connectingHandleId.current,
            className: '',
            style: { stroke: myUseStore.getState().getEdgeStyle(connectingHandleId.current).stroke }
          };
          myUseStore.getState().addNode(newNode);
          myUseStore.getState().onConnect(newEdge);
        }
      }
    },
    [nodes, edges, setNodes, project]
  );

  const addQuestion = () => {
    const newId = getId();
    const newNode = {
      id: newId,
      type: 'question',
      data: { label: `Question ${newId}`, product1: '', product2: '' },
      position: { x: id * 450, y: 100 },
    };
    myUseStore.getState().addNode(newNode);
  };

  const exportData = () => {
    const questionsData = {
      questions: {
        total: nodes.filter(n => n.type === 'question').length,
        offset: 0,
        limit: nodes.filter(n => n.type === 'question').length,
        data: nodes.filter(n => n.type === 'question').map(qNode => ({
          questions: qNode.id,
          "max-selections": qNode.data.maxSelections,
          "min-selections": qNode.data.minSelections
        }))
      }
    };

    nodes.filter(n => n.type === 'question').forEach(qNode => {
      questionsData[qNode.id] = {
        total: edges.filter(e => e.source === qNode.id).length,
        offset: 0,
        limit: edges.filter(e => e.source === qNode.id).length,
        data: edges.filter(e => e.source === qNode.id).map(e => ({
          options: e.target,
          next: nodes.find(n => n.id === e.target).data.next
        }))
      };
    });

    const stringsData = {
      questions: {
        total: nodes.filter(n => n.type === 'question').length,
        offset: 0,
        limit: nodes.filter(n => n.type === 'question').length,
        data: nodes.filter(n => n.type === 'question').map(qNode => ({
          q: qNode.id,
          heading: qNode.data.label,
          "sub-head": qNode.data.subtitle,
          btn: qNode.data.btnLabel,
          background: qNode.data.backgroundImage,
          footerFragment: qNode.data.footerFragment
        }))
      }
    };

    nodes.filter(n => n.type === 'option').forEach(optionNode => {
      stringsData[optionNode.id] = {
        total: 1,
        offset: 0,
        limit: 1,
        data: [{
          options: optionNode.id,
          title: optionNode.data.label,
          text: optionNode.data.text,
          icon: optionNode.data.icon,
          image: optionNode.data.image
        }]
      };
    });

    console.log('Exported Questions Data:', JSON.stringify(questionsData, null, 2));
    console.log('Exported Strings Data:', JSON.stringify(stringsData, null, 2));
  };

  return (
    <div className="wrapper flex" ref={reactFlowWrapper} style={{ height: '100vh' }}>
      <Sidebar
          addQuestion={addQuestion}
          onImportData={importData}
          exportData={exportData}
      />
      <div className="main-body">
      <sp-top-nav class="top-nav">
          <sp-top-nav-item href="#page-1">
            Visual Authoring
          </sp-top-nav-item>
          <sp-top-nav-item href="#page-2">
            Quiz Results
          </sp-top-nav-item>
          <sp-top-nav-item href="#page-2">
            Debugger
          </sp-top-nav-item>          
        </sp-top-nav>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          panOnScroll
          selectionOnDrag
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          elementsSelectable={true}
          connectionLineComponent={(props) => <CustomConnectionLine {...props} />}
          onNodeDoubleClick={handleDoubleClick}
          zoomOnDoubleClick={false}
        >
          <Background color="#aaa" gap={20} />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "question") return "#ccc";
              if (n.type === "option") return "pink";
              if (n.type === "default") return "#ccc";
              return "#eee";
            }}
            nodeBorderRadius={2}
            pannable={true}
            zoomable={true}
          />
          <Controls />
        </ReactFlow>
      </div>

      </div>
  );
};

export default () => (
  <ReactFlowProvider>
    <QuizEditor />
  </ReactFlowProvider>
);

