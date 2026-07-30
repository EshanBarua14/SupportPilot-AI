import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Pattern matching the timeline button in flat view
pattern = re.compile(
    r'(id={`btn-timeline-flat-\${inc\.id}`} [^>]*?>\s*<Icons\.GitCommit [^>]*?>\s*<span>Timeline</span>\s*</button>)\s*(\n\s*<span className={`text-\[7\.5px\] font-mono font-bold px-1\.5 py-0\.2 rounded border \${statusBadge\.color}`}\>)',
    re.DOTALL
)

dropdown_html = '''

                                                   {/* Assign to Group Dropdown Menu */}
                                                   <div 
                                                     className="relative inline-flex items-center shrink-0"
                                                     onClick={(e) => e.stopPropagation()}
                                                   >
                                                     <label htmlFor={`assign-group-flat-${inc.id}`} className="sr-only">Assign to Engineering Group</label>
                                                     <div className="relative flex items-center">
                                                       <Icons.Users className="absolute left-1.5 h-2.5 w-2.5 text-indigo-400 pointer-events-none z-10" />
                                                       <select
                                                         id={`assign-group-flat-${inc.id}`}
                                                         value={customIncidentAssignee[inc.id] || ''}
                                                         onChange={(e) => {
                                                           e.stopPropagation();
                                                           handleAssignIncidentGroup(inc.id, inc.title, e.target.value);
                                                         }}
                                                         className="pl-5 pr-4 py-0.2 text-[7.5px] font-mono font-bold bg-slate-950 text-indigo-200 hover:text-indigo-100 border border-indigo-700/60 hover:border-indigo-500 rounded cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                                                         title="Reassign incident immediately to engineering group and record in audit log"
                                                       >
                                                         <option value="" disabled className="bg-slate-900 text-slate-400">
                                                           {customIncidentAssignee[inc.id] ? `Pod: ${customIncidentAssignee[inc.id]}` : 'Assign Group...'}
                                                         </option>
                                                         <option value="SRE & Infrastructure Pod" className="bg-slate-900 text-slate-200">SRE & Infrastructure Pod</option>
                                                         <option value="Core Backend & DB Pod" className="bg-slate-900 text-slate-200">Core Backend & DB Pod</option>
                                                         <option value="Kubernetes Platform Pod" className="bg-slate-900 text-slate-200">Kubernetes Platform Pod</option>
                                                         <option value="Security & Incident Response" className="bg-slate-900 text-slate-200">Security & Incident Response</option>
                                                         <option value="API Gateway & Microservices" className="bg-slate-900 text-slate-200">API Gateway & Microservices</option>
                                                         <option value="L1 Support & Dispatch" className="bg-slate-900 text-slate-200">L1 Support & Dispatch</option>
                                                       </select>
                                                       <Icons.ChevronDown className="absolute right-1 h-2 w-2 text-indigo-400 pointer-events-none" />
                                                     </div>
                                                   </div>\\2'''

new_content, count = pattern.subn(r'\1' + dropdown_html, content, count=1)
print(f"Flat view replacement count: {count}")

with open('src/App.tsx', 'w') as f:
    f.write(new_content)
