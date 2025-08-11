import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, Home } from 'lucide-react';
import { useLocation } from 'wouter';
import type { Company, CompanyRelation, Property } from '@shared/schema';

interface CompanyNode extends Company {
  parents: Array<{ parent: Company; percentage: number }>;
  children: Array<{ child: Company; percentage: number }>;
  properties: Property[];
  level: number;
  x: number;
  y: number;
}

interface CompanyStructureChartProps {
  organizationId: string;
}

export default function CompanyStructureChart({ organizationId }: CompanyStructureChartProps) {
  const [, setLocation] = useLocation();

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const { data: relations, isLoading: relationsLoading } = useQuery<CompanyRelation[]>({
    queryKey: ['/api/company-relations'],
    refetchOnWindowFocus: true, 
    staleTime: 0
  });

  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const isLoading = companiesLoading || relationsLoading || propertiesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!companies || !relations || companies.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Ingen selskaber eller relationer fundet.</p>
        <p className="text-sm mt-2">Opret selskaber og relationer for at se koncernstrukturen.</p>
      </div>
    );
  }

  // Build company nodes with relationships
  const companyNodes: Map<string, CompanyNode> = new Map();
  
  // Initialize all companies
  companies.forEach(company => {
    companyNodes.set(company.id, {
      ...company,
      parents: [],
      children: [],
      properties: [],
      level: 0,
      x: 0,
      y: 0
    });
  });

  // Add properties to their owner companies
  if (properties) {
    properties.forEach(property => {
      if (property.ownerCompanyId) {
        const ownerCompany = companyNodes.get(property.ownerCompanyId);
        if (ownerCompany) {
          ownerCompany.properties.push(property);
        }
      }
    });
  }

  // Add relationships
  relations.forEach(relation => {
    const parent = companies.find(c => c.id === relation.parentCompanyId);
    const child = companies.find(c => c.id === relation.childCompanyId);
    
    if (parent && child) {
      const parentNode = companyNodes.get(parent.id);
      const childNode = companyNodes.get(child.id);
      
      if (parentNode && childNode) {
        childNode.parents.push({
          parent,
          percentage: parseInt(relation.ownershipPercentage)
        });
        
        parentNode.children.push({
          child,
          percentage: parseInt(relation.ownershipPercentage)
        });
      }
    }
  });

  // Calculate levels and positions with special layout for ultimate owners
  const calculateLayout = () => {
    // Find all ultimate owners (companies with no parents)
    const ultimateOwners = Array.from(companyNodes.values()).filter(
      node => node.parents.length === 0
    );

    // Find all leaf companies (companies with no children)
    const leafCompanies = Array.from(companyNodes.values()).filter(
      node => node.children.length === 0
    );

    // Find intermediate companies (companies that have both parents and children)
    const intermediateCompanies = Array.from(companyNodes.values()).filter(
      node => node.parents.length > 0 && node.children.length > 0
    );

    // Create a mapping of which ultimate owners connect to which leaf companies
    const ownershipPaths: Map<string, { leaf: CompanyNode; intermediates: CompanyNode[]; percentage: number }[]> = new Map();
    
    // For each ultimate owner, trace all paths to leaf companies
    ultimateOwners.forEach(owner => {
      const paths: { leaf: CompanyNode; intermediates: CompanyNode[]; percentage: number }[] = [];
      
      const tracePaths = (currentNode: CompanyNode, intermediates: CompanyNode[], cumulativePercentage: number) => {
        if (currentNode.children.length === 0) {
          // This is a leaf company
          paths.push({ 
            leaf: currentNode, 
            intermediates: [...intermediates],
            percentage: cumulativePercentage
          });
        } else {
          // Continue tracing through children
          currentNode.children.forEach(childRel => {
            const childNode = companyNodes.get(childRel.child.id);
            if (childNode) {
              const newIntermediates = currentNode === owner ? intermediates : [...intermediates, currentNode];
              tracePaths(childNode, newIntermediates, childRel.percentage);
            }
          });
        }
      };
      
      tracePaths(owner, [], 100);
      ownershipPaths.set(owner.id, paths);
    });

    // Layout: Ultimate owners on top row, intermediates in middle, leaf companies at bottom, properties under leaf companies
    const levelGroups: CompanyNode[][] = [[], [], []]; // 3 levels max for this layout
    const nodeWidth = 400; // More width to accommodate properties
    const levelHeight = 340; // Increased height to accommodate properties with more spacing

    // Level 0: Ultimate owners
    ultimateOwners.forEach((owner, index) => {
      owner.level = 0;
      owner.x = 100 + (index * nodeWidth);
      owner.y = 50;
      levelGroups[0].push(owner);
    });

    // Level 2: Leaf companies (bottom row)
    leafCompanies.forEach((leaf, index) => {
      leaf.level = 2;
      leaf.x = 100 + (index * nodeWidth);
      leaf.y = 50 + (2 * levelHeight);
      levelGroups[2].push(leaf);
    });

    // Level 1: Intermediate companies (middle row) - only if they exist in ownership chain
    const usedIntermediates = new Set<string>();
    ultimateOwners.forEach(owner => {
      const paths = ownershipPaths.get(owner.id) || [];
      paths.forEach(path => {
        path.intermediates.forEach(intermediate => {
          if (!usedIntermediates.has(intermediate.id)) {
            usedIntermediates.add(intermediate.id);
            levelGroups[1].push(intermediate);
          }
        });
      });
    });

    // Position intermediate companies
    levelGroups[1].forEach((intermediate, index) => {
      intermediate.level = 1;
      intermediate.x = 100 + (index * nodeWidth);
      intermediate.y = 50 + levelHeight;
    });

    // Adjust horizontal spacing based on number of companies in each level
    const maxNodesInLevel = Math.max(
      levelGroups[0].length,
      levelGroups[1].length, 
      levelGroups[2].length
    );
    
    const minSvgWidth = Math.max(1200, maxNodesInLevel * nodeWidth + 300);
    
    // Re-center each level
    levelGroups.forEach((levelNodes, level) => {
      if (levelNodes.length > 0) {
        const totalWidth = levelNodes.length * nodeWidth;
        const startX = Math.max(100, (minSvgWidth - totalWidth) / 2);
        
        levelNodes.forEach((node, index) => {
          node.x = startX + (index * nodeWidth);
        });
      }
    });

    return levelGroups.filter(level => level.length > 0); // Remove empty levels
  };

  const levelGroups = calculateLayout();
  const allNodes = Array.from(companyNodes.values());
  const maxLevel = Math.max(...allNodes.map(n => n.level));
  const maxNodesInLevel = Math.max(...levelGroups.map(level => level.length));
  const svgWidth = Math.max(1200, maxNodesInLevel * 400 + 300);
  // Calculate height based on properties per company
  const maxPropertiesPerCompany = Math.max(1, ...allNodes.map(node => node.properties.length));
  const svgHeight = (maxLevel + 1) * 340 + 200 + (maxPropertiesPerCompany > 0 ? 100 : 0); // Dynamic height for properties with more spacing

  // Generate SVG paths for connections
  const generateConnections = () => {
    const connections: JSX.Element[] = [];
    
    allNodes.forEach(parentNode => {
      parentNode.children.forEach(childRel => {
        const childNode = companyNodes.get(childRel.child.id);
        if (childNode) {
          const parentCenterX = parentNode.x + 70; // Half of company circle width
          const parentCenterY = parentNode.y + 70;
          const childCenterX = childNode.x + 70;
          const childCenterY = childNode.y + 70;
          
          // Draw line from parent to child
          connections.push(
            <g key={`${parentNode.id}-${childNode.id}`}>
              {/* Connection line - handle both vertical and angled connections */}
              <line
                x1={parentCenterX}
                y1={parentCenterY + 35} // Start from bottom of parent circle
                x2={childCenterX}
                y2={childCenterY - 35} // End at top of child circle
                stroke="rgb(59 130 246)" // blue-500
                strokeWidth="3"
                className="stroke-blue-500 dark:stroke-blue-400"
              />
              
              {/* Arrow */}
              <polygon
                points={`${childCenterX-8},${childCenterY-43} ${childCenterX+8},${childCenterY-43} ${childCenterX},${childCenterY-27}`}
                fill="rgb(59 130 246)"
                className="fill-blue-500 dark:fill-blue-400"
              />
              
              {/* Ownership percentage box */}
              <g>
                <rect
                  x={(parentCenterX + childCenterX) / 2 - 35}
                  y={(parentCenterY + childCenterY) / 2 - 12}
                  width="70"
                  height="24"
                  rx="4"
                  fill="rgb(229 231 235)"
                  stroke="rgb(156 163 175)"
                  strokeWidth="1"
                  className="fill-gray-200 dark:fill-gray-700 stroke-gray-400 dark:stroke-gray-500"
                />
                <text
                  x={(parentCenterX + childCenterX) / 2 - 8}
                  y={(parentCenterY + childCenterY) / 2 + 4}
                  textAnchor="middle"
                  className="text-sm font-bold fill-gray-900 dark:fill-white"
                  fontSize="12"
                >
                  {childRel.percentage}%
                </text>

              </g>
            </g>
          );
        }
      });
    });
    
    return connections;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Koncernstruktur
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Stamtræ over selskabsstruktur og ejerskabsforhold
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <svg 
              width={svgWidth} 
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              {/* Render connections */}
              {generateConnections()}
              
              {/* Render company nodes */}
              {allNodes.map(company => (
                <g key={company.id}>
                  {/* Company circle */}
                  <circle
                    cx={company.x + 70}
                    cy={company.y + 70}
                    r="35"
                    fill="rgb(51 65 85)"
                    className="fill-slate-700 dark:fill-slate-600"
                  />
                  
                  {/* Building icon */}
                  <g transform={`translate(${company.x + 55}, ${company.y + 55})`}>
                    <Building2 
                      size={30} 
                      color="white"
                      className="stroke-white"
                    />
                  </g>
                  
                  {/* Company name */}
                  <text
                    x={company.x + 70}
                    y={company.y + 130}
                    textAnchor="middle"
                    className="text-sm font-bold fill-gray-900 dark:fill-white"
                    fontSize="14"
                  >
                    {company.name}
                  </text>
                  
                  {/* CVR number */}
                  <text
                    x={company.x + 70}
                    y={company.y + 145}
                    textAnchor="middle"
                    className="text-xs fill-gray-600 dark:fill-gray-400"
                    fontSize="12"
                  >
                    CVR: {company.cvrNumber}
                  </text>
                  
                  {/* Properties owned by this company */}
                  {company.properties.map((property, index) => {
                    // For single property: center it under the company
                    // For multiple properties: spread them horizontally but with better spacing
                    let propX, propY;
                    
                    if (company.properties.length === 1) {
                      // Single property - center it directly under the company
                      propX = company.x + 30; // Center under company circle (140px width, property 80px width)
                      propY = company.y + 220;
                    } else {
                      // Multiple properties - spread horizontally
                      const totalWidth = company.properties.length * 100; // 100px per property including spacing
                      const startX = company.x + 70 - totalWidth / 2; // Center the group under company
                      propX = startX + index * 100;
                      propY = company.y + 220;
                    }
                    
                    return (
                      <g key={property.id}>
                        {/* Connection line from company to property - 60% transparent */}
                        <line
                          x1={company.x + 70}
                          y1={company.y + 105}
                          x2={propX + 40}
                          y2={propY - 15}
                          stroke="rgb(34 197 94)"
                          strokeWidth="2"
                          strokeOpacity="0.4"
                          className="stroke-green-500 dark:stroke-green-400"
                        />
                        
                        {/* Clickable property rectangle */}
                        <rect
                          x={propX}
                          y={propY}
                          width="80"
                          height="45"
                          rx="8"
                          fill="rgb(34 197 94)"
                          className="fill-green-500 dark:fill-green-600 cursor-pointer hover:fill-green-600 dark:hover:fill-green-500"
                          onClick={() => setLocation(`/properties/${property.id}`)}
                        />
                        
                        {/* Home icon - centered in the box */}
                        <g transform={`translate(${propX + 31}, ${propY + 13})`}>
                          <Home 
                            size={18} 
                            color="white"
                            className="stroke-white pointer-events-none"
                          />
                        </g>
                        
                        {/* Property name (below the rectangle) */}
                        <text
                          x={propX + 40}
                          y={propY + 65}
                          textAnchor="middle"
                          className="text-sm fill-gray-800 dark:fill-gray-200 font-semibold pointer-events-none"
                          fontSize="13"
                        >
                          {property.name && property.name.trim() ? 
                            (property.name.length > 18 ? `${property.name.substring(0, 18)}...` : property.name) : 
                            (property.address.length > 18 ? `${property.address.substring(0, 18)}...` : property.address)
                          }
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Sammendrag
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {companies.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Selskaber i alt
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {relations.length}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ejerskabsforhold
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {properties?.length || 0}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Ejendomme i alt
              </p>
            </CardContent>
          </Card>
        </div>
      </div>


    </div>
  );
}