import { PrecisionHeader, VersionHeader } from '../shader/common'

export const vertexShaderSource = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_position;
in vec3 a_color;
in float a_flags;
flat out vec3 v_color;
flat out vec3 v_currentPosition;
out vec3 v_currentPosition2;
flat out int v_flags;
out vec4 v_fragPosLightSpace;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
uniform mat4 u_lightSpaceMatrix;
void main() {
	v_flags = int(a_flags);
	v_color = a_color;
	v_currentPosition = a_position;
	v_currentPosition2 = a_position;
	vec3 pos = a_position;
	if (pos.y < 4.50) {
		pos.y += sin(u_time * 2.1 + pos.x + pos.z * 100.0) * 0.15 + 0.5;
	}
	vec4 worldPosition = vec4(pos, 1);
	v_fragPosLightSpace = u_lightSpaceMatrix * worldPosition;
    gl_Position = u_projection * u_view * worldPosition;
}
`

export const fragmentShaderSource = `${VersionHeader()}
${PrecisionHeader()}
out vec4 finalColor;
flat in int v_flags;
flat in vec3 v_color;
flat in vec3 v_currentPosition;
in vec3 v_currentPosition2;
in vec4 v_fragPosLightSpace;
uniform float u_time;
uniform vec3 u_lightPosition;
uniform sampler2D u_shadowMap;
const float ambientLight = 0.3;
void main() {
	vec3 normal = vec3(ivec3(((v_flags >> 4) & 3) - 1, ((v_flags >> 2) & 3) - 1, (v_flags & 3) - 1));
	vec3 lightDirection = normalize(u_lightPosition - v_currentPosition);
	// float diffuse = max(dot(normal, lightDirection), ambientLight);
	// vec3 lightColor = mix(vec3(1,1,0.8), vec3(1,0.57,0.3), sin(u_time * 0.3) * 0.5 + 0.5);
	
	
    vec3 projCoords = v_fragPosLightSpace.xyz / v_fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    float closestDepth = texture(u_shadowMap, projCoords.xy).r; 
    float currentDepth = projCoords.z;
    float bias = 0.0005;
	vec2 texelSize = vec2(1.0 / 8192.0);
	float shadow = 0.0;
	for(int x = -1; x <= 1; ++x)
	    for(int y = -1; y <= 1; ++y) {
	        float pcfDepth = texture(u_shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
	        shadow += currentDepth - bias < pcfDepth ? 1.0 : 0.3;        
	    }
	shadow /= 9.0;
	// shadow = currentDepth - bias < texture(u_shadowMap, projCoords.xy).r ? 1.0 : 0.3;
	
	float diffuse = 1.0;
	vec3 lightColor = vec3(1,1,1);
	finalColor = vec4(v_color * lightColor * diffuse * shadow, 1);
	// finalColor = vec4(normal * 0.5 + 0.5, 1);
}
`


export const vertexShaderSource2 = `${VersionHeader()}
${PrecisionHeader()}
in vec3 a_position;
uniform mat4 u_projection;
uniform mat4 u_view;
uniform float u_time;
void main() {
    gl_Position = u_projection * u_view * vec4(a_position, 1);
}
`

export const fragmentShaderSource2 = `${VersionHeader()}
${PrecisionHeader()}
void main() {
}
`


export type Uniforms = 'time' | 'projection' | 'view' | 'lightPosition' | 'lightSpaceMatrix' | 'shadowMap'
export type Attributes = 'position' | 'color' | 'flags'
